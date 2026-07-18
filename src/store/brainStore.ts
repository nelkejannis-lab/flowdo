import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createId } from '../utils/id'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export interface NoteChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface NotePage {
  id: string
  columnId: string
  title: string
  content: string
  summary?: string
  checklist?: NoteChecklistItem[]
  tags?: string[]
  people?: { name: string }[]
  linkedBoardId?: string
  audioBase64?: string
  audioDuration?: number
  createdAt: string
  updatedAt: string
}

export interface NoteColumn {
  id: string
  title: string
  position: number
}

interface BrainState {
  columns: NoteColumn[]
  pages: NotePage[]
  loading: boolean
  fetchAll: () => Promise<void>
  addColumn: (title: string) => void
  ensureColumn: (id: string, title: string) => string
  updateColumn: (id: string, title: string) => void
  deleteColumn: (id: string) => void
  addPage: (columnId: string, title: string, content: string, checklist?: NoteChecklistItem[]) => void
  updatePage: (id: string, updates: Partial<NotePage>) => void
  deletePage: (id: string) => void
  movePage: (id: string, targetColumnId: string) => void
  reorderColumns: (columns: NoteColumn[]) => void
  reorderPages: (pages: NotePage[]) => void
  subscribeToBrain: () => () => void
}

const DEFAULT_COLUMNS: NoteColumn[] = [
  { id: 'notes', title: 'Notizen', position: 0 },
  { id: 'journal', title: 'Journal', position: 1 },
  { id: 'meetings', title: 'Meetings', position: 2 },
  { id: 'ideas', title: 'Ideen & Entwürfe', position: 3 },
  { id: 'summaries', title: 'Zusammenfassungen', position: 4 },
]

async function getUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

async function syncColumn(col: NoteColumn, userId: string) {
  if (!isSupabaseConfigured) return
  await supabase.from('brain_columns').upsert({
    id: col.id,
    owner_id: userId,
    title: col.title,
    position: col.position
  })
}

async function syncPage(page: NotePage, userId: string) {
  if (!isSupabaseConfigured) return
  await supabase.from('brain_pages').upsert({
    id: page.id,
    owner_id: userId,
    column_id: page.columnId,
    title: page.title,
    content: page.content,
    summary: page.summary ?? null,
    checklist: page.checklist ?? [],
    tags: page.tags ?? [],
    people: page.people ?? [],
    linked_board_id: page.linkedBoardId ?? null,
    audio_base64: page.audioBase64 ?? null,
    audio_duration: page.audioDuration ?? null,
    created_at: page.createdAt,
    updated_at: page.updatedAt
  })
}

async function deleteColumnFromDb(id: string) {
  if (!isSupabaseConfigured) return
  await supabase.from('brain_columns').delete().eq('id', id)
}

async function deletePageFromDb(id: string) {
  if (!isSupabaseConfigured) return
  await supabase.from('brain_pages').delete().eq('id', id)
}

export const useBrainStore = create<BrainState>()(
  persist(
    (set, get) => ({
      columns: DEFAULT_COLUMNS,
      pages: [],
      loading: false,

      fetchAll: async () => {
        const userId = await getUserId()
        if (!userId) return

        set({ loading: true })

        const [colsRes, pagesRes] = await Promise.all([
          supabase.from('brain_columns').select('*').eq('owner_id', userId).order('position', { ascending: true }),
          supabase.from('brain_pages').select('*').eq('owner_id', userId).order('updated_at', { ascending: false })
        ])

        if (colsRes.error || pagesRes.error) {
          set({ loading: false })
          return
        }

        let syncedCols: NoteColumn[] = (colsRes.data ?? []).map((c: any) => ({
          id: c.id,
          title: c.title,
          position: c.position
        }))

        const syncedPages: NotePage[] = (pagesRes.data ?? []).map((p: any) => ({
          id: p.id,
          columnId: p.column_id,
          title: p.title,
          content: p.content,
          summary: p.summary ?? undefined,
          checklist: p.checklist ?? [],
          tags: p.tags ?? [],
          people: p.people ?? [],
          linkedBoardId: p.linked_board_id ?? undefined,
          audioBase64: p.audio_base64 ?? undefined,
          audioDuration: p.audio_duration ?? undefined,
          createdAt: p.created_at,
          updatedAt: p.updated_at
        }))

        // If user has no columns in DB yet, upload current local columns
        if (syncedCols.length === 0) {
          const localCols = get().columns.length > 0 ? get().columns : DEFAULT_COLUMNS
          for (const col of localCols) {
            await syncColumn(col, userId)
          }
          syncedCols = localCols
        }

        // Merge local pages that are not in DB (created before sync/login)
        const dbPageIds = new Set(syncedPages.map(p => p.id))
        const localOnlyPages = get().pages.filter(p => !dbPageIds.has(p.id))
        for (const p of localOnlyPages) {
          await syncPage(p, userId)
        }

        set({
          columns: syncedCols,
          pages: [...localOnlyPages, ...syncedPages],
          loading: false
        })
      },

      addColumn: (title) =>
        set((state) => {
          const newCol: NoteColumn = {
            id: createId(),
            title,
            position: state.columns.length,
          }
          void getUserId().then((userId) => {
            if (userId) void syncColumn(newCol, userId)
          })
          return { columns: [...state.columns, newCol] }
        }),

      ensureColumn: (id, title) => {
        const existing = get().columns.find((c) => c.id === id || c.title.toLowerCase() === title.toLowerCase())
        if (existing) return existing.id
        const newCol: NoteColumn = {
          id,
          title,
          position: get().columns.length,
        }
        set((state) => ({ columns: [...state.columns, newCol] }))
        void getUserId().then((userId) => {
          if (userId) void syncColumn(newCol, userId)
        })
        return id
      },

      updateColumn: (id, title) =>
        set((state) => {
          const updated = state.columns.map((c) => (c.id === id ? { ...c, title } : c))
          const col = updated.find((c) => c.id === id)
          if (col) {
            void getUserId().then((userId) => {
              if (userId) void syncColumn(col, userId)
            })
          }
          return { columns: updated }
        }),

      deleteColumn: (id) =>
        set((state) => {
          const fallbackCol = state.columns.find((c) => c.id !== id)
          const fallbackId = fallbackCol ? fallbackCol.id : 'notes'
          const remainingCols = state.columns.filter((c) => c.id !== id)
          const updatedPages = state.pages.map((p) =>
            p.columnId === id ? { ...p, columnId: fallbackId, updatedAt: new Date().toISOString() } : p
          )

          void getUserId().then((userId) => {
            if (userId) {
              void deleteColumnFromDb(id)
              for (const p of updatedPages) {
                if (p.columnId === fallbackId) {
                  void syncPage(p, userId)
                }
              }
            }
          })

          return {
            columns: remainingCols,
            pages: updatedPages,
          }
        }),

      addPage: (columnId, title, content, checklist) =>
        set((state) => {
          const newPage: NotePage = {
            id: createId(),
            columnId,
            title: title.trim() || 'Unbenannte Seite',
            content,
            checklist: checklist ?? [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          void getUserId().then((userId) => {
            if (userId) void syncPage(newPage, userId)
          })
          return { pages: [newPage, ...state.pages] }
        }),

      updatePage: (id, updates) =>
        set((state) => {
          const updatedPages = state.pages.map((p) => {
            if (p.id !== id) return p
            const newP = {
              ...p,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
            void getUserId().then((userId) => {
              if (userId) void syncPage(newP, userId)
            })
            return newP
          })
          return { pages: updatedPages }
        }),

      deletePage: (id) => {
        void deletePageFromDb(id)
        set((state) => ({
          pages: state.pages.filter((p) => p.id !== id),
        }))
      },

      movePage: (id, targetColumnId) =>
        set((state) => {
          const updatedPages = state.pages.map((p) => {
            if (p.id !== id) return p
            const newP = { ...p, columnId: targetColumnId, updatedAt: new Date().toISOString() }
            void getUserId().then((userId) => {
              if (userId) void syncPage(newP, userId)
            })
            return newP
          })
          return { pages: updatedPages }
        }),

      reorderColumns: (columns) => {
        set({ columns })
        void getUserId().then((userId) => {
          if (userId) {
            columns.forEach((col, idx) => {
              void syncColumn({ ...col, position: idx }, userId)
            })
          }
        })
      },

      reorderPages: (pages) => {
        set({ pages })
        void getUserId().then((userId) => {
          if (userId) {
            pages.forEach((p) => {
              void syncPage(p, userId)
            })
          }
        })
      },

      subscribeToBrain: () => {
        if (!isSupabaseConfigured) return () => {}
        let channel: ReturnType<typeof supabase.channel> | null = null
        let cancelled = false

        getUserId().then((userId) => {
          if (cancelled || !userId) return
          channel = supabase
            .channel('brain-realtime')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'brain_columns', filter: `owner_id=eq.${userId}` },
              () => get().fetchAll()
            )
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'brain_pages', filter: `owner_id=eq.${userId}` },
              () => get().fetchAll()
            )
            .subscribe()
        })

        return () => {
          cancelled = true
          if (channel) supabase.removeChannel(channel)
        }
      },
    }),
    {
      name: 'flowdo-second-brain',
      version: 1,
    }
  )
)
