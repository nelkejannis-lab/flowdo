import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createId } from '../utils/id'

export interface NotePage {
  id: string
  columnId: string
  title: string
  content: string
  summary?: string
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
  addColumn: (title: string) => void
  updateColumn: (id: string, title: string) => void
  deleteColumn: (id: string) => void
  addPage: (columnId: string, title: string, content: string) => void
  updatePage: (id: string, updates: Partial<NotePage>) => void
  deletePage: (id: string) => void
  movePage: (id: string, targetColumnId: string) => void
  reorderColumns: (columns: NoteColumn[]) => void
  reorderPages: (pages: NotePage[]) => void
}

const DEFAULT_COLUMNS: NoteColumn[] = [
  { id: 'notes', title: 'Notizen', position: 0 },
  { id: 'meetings', title: 'Meetings', position: 1 },
  { id: 'ideas', title: 'Ideen & Entwürfe', position: 2 },
  { id: 'summaries', title: 'Zusammenfassungen', position: 3 },
]

export const useBrainStore = create<BrainState>()(
  persist(
    (set) => ({
      columns: DEFAULT_COLUMNS,
      pages: [],

      addColumn: (title) =>
        set((state) => {
          const newCol: NoteColumn = {
            id: createId(),
            title,
            position: state.columns.length,
          }
          return { columns: [...state.columns, newCol] }
        }),

      updateColumn: (id, title) =>
        set((state) => ({
          columns: state.columns.map((c) => (c.id === id ? { ...c, title } : c)),
        })),

      deleteColumn: (id) =>
        set((state) => {
          // If deleted, move all pages in that column to the first column or delete them.
          // We will delete the pages inside the column to keep it clean, or assign them to the first available column.
          const fallbackCol = state.columns.find((c) => c.id !== id)
          return {
            columns: state.columns.filter((c) => c.id !== id),
            pages: state.pages.map((p) =>
              p.columnId === id ? { ...p, columnId: fallbackCol ? fallbackCol.id : 'notes' } : p
            ),
          }
        }),

      addPage: (columnId, title, content) =>
        set((state) => {
          const newPage: NotePage = {
            id: createId(),
            columnId,
            title: title.trim() || 'Unbenannte Seite',
            content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          return { pages: [newPage, ...state.pages] }
        }),

      updatePage: (id, updates) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === id
              ? {
                  ...p,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        })),

      deletePage: (id) =>
        set((state) => ({
          pages: state.pages.filter((p) => p.id !== id),
        })),

      movePage: (id, targetColumnId) =>
        set((state) => ({
          pages: state.pages.map((p) =>
            p.id === id ? { ...p, columnId: targetColumnId, updatedAt: new Date().toISOString() } : p
          ),
        })),

      reorderColumns: (columns) => set({ columns }),
      reorderPages: (pages) => set({ pages }),
    }),
    {
      name: 'flowdo-second-brain',
      version: 1,
    }
  )
)
