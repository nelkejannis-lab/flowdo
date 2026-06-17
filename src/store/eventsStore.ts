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
  deleteEvent: (id: string) => void
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set, get) => ({
      events: [],
      deletedEventIds: [],

      fetchAll: async () => {
        const userId = await getUserId()
        if (!userId) return

        const deleted = new Set([...get().deletedEventIds, ...pendingDeletes])

        const { data, error } = await supabase
          .from('calendar_events')
          .select('*')
          .eq('owner_id', userId)
          .order('date', { ascending: true })
        if (error) return

        const remote = ((data ?? []) as CalendarEventRow[]).map(toEvent).filter((e) => !deleted.has(e.id))
        const remoteIds = new Set(remote.map((e) => e.id))
        const localOnly = get().events.filter((e) => !remoteIds.has(e.id) && !deleted.has(e.id))

        for (const event of localOnly) {
          await syncEvent(event, userId)
        }

        // Retry any persisted deletes that haven't reached Supabase yet
        for (const id of get().deletedEventIds) {
          void supabase.from('calendar_events').delete().eq('id', id).eq('owner_id', userId)
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
        pendingDeletes.add(id)
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
          deletedEventIds: [...state.deletedEventIds, id],
        }))
        void getUserId().then(async (userId) => {
          if (userId) await supabase.from('calendar_events').delete().eq('id', id)
          pendingDeletes.delete(id)
          // Remove from persisted blacklist once Supabase confirmed
          set((state) => ({ deletedEventIds: state.deletedEventIds.filter((x) => x !== id) }))
        })
      },
    }),
    { name: 'flowdo-events' }
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
