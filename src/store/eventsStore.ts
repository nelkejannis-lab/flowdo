import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalendarEvent } from '../types'
import { createId } from '../utils/id'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface NewEventInput {
  title: string
  date: string
  endDate?: string
  description?: string
  color: string
}

interface CalendarEventRow {
  id: string
  title: string
  description: string | null
  date: string
  end_date: string | null
  color: string
  created_at: string
}

function toEvent(row: CalendarEventRow): CalendarEvent {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    endDate: row.end_date ?? undefined,
    description: row.description ?? undefined,
    color: row.color,
    createdAt: row.created_at,
  }
}

async function getUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

async function syncEvent(event: CalendarEvent, userId: string) {
  await supabase.from('calendar_events').upsert({
    id: event.id,
    owner_id: userId,
    title: event.title,
    description: event.description ?? null,
    date: event.date,
    end_date: event.endDate ?? null,
    color: event.color,
    created_at: event.createdAt,
  })
}

interface EventsState {
  events: CalendarEvent[]
  fetchAll: () => Promise<void>
  addEvent: (input: NewEventInput) => CalendarEvent
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      events: [],

      fetchAll: async () => {
        const userId = await getUserId()
        if (!userId) return

        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('owner_id', userId)
          .order('date', { ascending: true })
        if (error) return

        const remote = ((data ?? []) as CalendarEventRow[]).map(toEvent)
        const remoteIds = new Set(remote.map((e) => e.id))
        const localOnly = get().events.filter((e) => !remoteIds.has(e.id))

        for (const event of localOnly) {
          await syncEvent(event, userId)
        }

        set({ events: [...localOnly, ...remote] })
      },

      addEvent: (input) => {
        const event: CalendarEvent = {
          id: createId(),
          title: input.title,
          date: input.date,
          endDate: input.endDate,
          description: input.description,
          color: input.color,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ events: [...state.events, event] }))
        void getUserId().then((userId) => {
          if (userId) void syncEvent(event, userId)
        })
        return event
      },

      updateEvent: (id, updates) => {
        let updated: CalendarEvent | undefined
        set((state) => ({
          events: state.events.map((e) => {
            if (e.id !== id) return e
            updated = { ...e, ...updates }
            return updated
          }),
        }))
        if (updated) {
          void getUserId().then((userId) => {
            if (userId && updated) void syncEvent(updated, userId)
          })
        }
      },

      deleteEvent: (id) => {
        set((state) => ({ events: state.events.filter((e) => e.id !== id) }))
        void getUserId().then((userId) => {
          if (userId) void supabase.from('calendar_events').delete().eq('id', id)
        })
      },
    }),
    { name: 'flowdo-events' }
  )
)

export const EVENT_COLORS = [
  '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444',
]
