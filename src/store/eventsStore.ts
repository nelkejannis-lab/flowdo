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

const pendingDeletes = new Set<string>()

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
  deletedEventIds: string[]
  fetchAll: () => Promise<void>
  addEvent: (input: NewEventInput) => CalendarEvent
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => Promise<void>
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      events: [],
      deletedEventIds: [],

      fetchAll: async () => {
        const userId = await getUserId()
        const deleted = new Set([...get().deletedEventIds, ...pendingDeletes])

        if (!userId) {
          set((state) => ({
            events: state.events.filter((e) => !deleted.has(e.id)),
          }))
          return
        }

        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('owner_id', userId)
          .order('date', { ascending: true })

        if (error) {
          console.error('[fetchAll events] failed:', error.message)
          set((state) => ({
            events: state.events.filter((e) => !deleted.has(e.id)),
          }))
          return
        }

        const remote = ((data ?? []) as CalendarEventRow[]).map(toEvent)
        const remoteIds = new Set(remote.map((e) => e.id))

        for (const id of deleted) {
          if (remoteIds.has(id)) {
            const { error: delErr } = await supabase
              .from('calendar_events')
              .delete()
              .eq('id', id)
              .eq('owner_id', userId)
            if (delErr) console.error('[fetchAll events] retry delete failed:', delErr.message)
          }
        }

        const visible = remote.filter((e) => !deleted.has(e.id))

        set({
          events: visible,
          deletedEventIds: get().deletedEventIds.filter((id) => remoteIds.has(id)),
        })
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

      deleteEvent: async (id) => {
        pendingDeletes.add(id)
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
          deletedEventIds: state.deletedEventIds.includes(id)
            ? state.deletedEventIds
            : [...state.deletedEventIds, id],
        }))

        try {
          const userId = await getUserId()
          if (userId) {
            const { error } = await supabase
              .from('calendar_events')
              .delete()
              .eq('id', id)
              .eq('owner_id', userId)
            if (error) {
              console.error('[deleteEvent] failed in Supabase:', error.message)
            }
          }
        } finally {
          pendingDeletes.delete(id)
        }
      },
    }),
    {
      name: 'flowdo-events',
      partialize: (state) => ({ deletedEventIds: state.deletedEventIds }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<EventsState>),
        events: [],
      }),
    }
  )
)

export const NAMED_COLORS: { hex: string; label: string }[] = [
  { hex: '#8B5CF6', label: 'Meeting' },
  { hex: '#EF4444', label: 'Dringend' },
  { hex: '#F59E0B', label: 'Deadline' },
  { hex: '#10B981', label: 'Erledigt' },
  { hex: '#06B6D4', label: 'Info' },
  { hex: '#EC4899', label: 'Wichtig' },
  { hex: '#3B82F6', label: 'Präsentation' },
  { hex: '#F97316', label: 'Reise' },
  { hex: '#14B8A6', label: 'Privat' },
  { hex: '#84CC16', label: 'Sport' },
  { hex: '#6366F1', label: 'Lernen' },
  { hex: '#DB2777', label: 'Social' },
  { hex: '#64748B', label: 'Sonstige' },
]

export const EVENT_COLORS = NAMED_COLORS.map((c) => c.hex)
