import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createId } from '../utils/id'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export type MemorySource = 'whatsapp' | 'manual' | 'meeting' | 'brain'

export interface MemoryItem {
  id: string
  text: string
  source: MemorySource
  meetingId?: string
  tags: string[]
  createdAt: string
  linkedBrainPageId?: string
}

interface MemoryState {
  items: MemoryItem[]
  fetchAll: () => Promise<void>
  addMemory: (input: Omit<MemoryItem, 'id' | 'createdAt'>) => MemoryItem
  deleteMemory: (id: string) => void
  linkToBrain: (id: string, pageId: string) => void
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      items: [],

      fetchAll: async () => {
        if (!isSupabaseConfigured) return
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (!userId) return
        const { data } = await supabase
          .from('memory_items')
          .select('*')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false })
        if (!data) return
        set({
          items: data.map((r: Record<string, unknown>) => ({
            id: r.id as string,
            text: r.text as string,
            source: r.source as MemorySource,
            meetingId: (r.meeting_id as string) ?? undefined,
            tags: (r.tags as string[]) ?? [],
            createdAt: r.created_at as string,
            linkedBrainPageId: (r.linked_brain_page_id as string) ?? undefined,
          })),
        })
      },

      addMemory: (input) => {
        const item: MemoryItem = {
          ...input,
          id: createId(),
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ items: [item, ...s.items] }))
        if (isSupabaseConfigured) {
          void supabase.auth.getUser().then(({ data }) => {
            const userId = data.user?.id
            if (!userId) return
            void supabase.from('memory_items').insert({
              id: item.id,
              owner_id: userId,
              text: item.text,
              source: item.source,
              meeting_id: item.meetingId ?? null,
              tags: item.tags,
              linked_brain_page_id: item.linkedBrainPageId ?? null,
            })
          })
        }
        return item
      },

      deleteMemory: (id) => {
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }))
        if (isSupabaseConfigured) {
          void supabase.from('memory_items').delete().eq('id', id)
        }
      },

      linkToBrain: (id, pageId) => {
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, linkedBrainPageId: pageId } : i)),
        }))
        if (isSupabaseConfigured) {
          void supabase.from('memory_items').update({ linked_brain_page_id: pageId }).eq('id', id)
        }
      },
    }),
    { name: 'flowdo-memory', onRehydrateStorage: () => (state) => { if (state && !state.items) state.items = [] } }
  )
)
