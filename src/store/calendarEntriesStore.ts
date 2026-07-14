import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { CalendarEntry, CalendarEntryInvitee, CalendarEntryType } from '../types'
import { occurrenceKey, parseCalendarEntryId } from '../utils/calendarEntry'

interface CalendarEntryRow {
  id: string
  owner_id: string
  type: CalendarEntryType
  title: string
  description: string | null
  date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
  color: string
  completed: boolean | null
  meeting_link: string | null
  created_at: string
  owner: CalendarEntryInvitee | CalendarEntryInvitee[] | null
  calendar_entry_invites: { user: CalendarEntryInvitee | CalendarEntryInvitee[] }[] | null
}

export interface NewCalendarEntryInput {
  type: CalendarEntryType
  title: string
  description?: string
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
  color: string
  invitedUserIds: string[]
  recurrence?: CalendarEntry['recurrence']
  meetingLink?: string
}

interface CalendarEntriesState {
  entries: CalendarEntry[]
  deletedEntryIds: string[]
  hiddenOccurrences: string[]
  loading: boolean
  error: string | null
  fetchEntries: () => Promise<void>
  addEntry: (input: NewCalendarEntryInput) => Promise<string | null>
  updateEntry: (id: string, input: NewCalendarEntryInput) => Promise<string | null>
  toggleCompleted: (id: string) => Promise<void>
  rescheduleEntry: (id: string, patch: { date?: string; endDate?: string | null; startTime?: string | null; endTime?: string | null }) => Promise<void>
  deleteEntry: (id: string, occurrenceDate?: string) => Promise<void>
  undoDelete: (id: string) => void
  subscribeToEntries: () => () => void
}

const pendingDeletes = new Set<string>()

function single<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value
}

function toEntry(row: CalendarEntryRow & { recurrence?: string | null }): CalendarEntry {
  return {
    id: row.id,
    ownerId: row.owner_id,
    owner: row.owner ? single(row.owner) : undefined,
    type: row.type,
    title: row.title,
    description: row.description ?? undefined,
    date: row.date,
    endDate: row.end_date ?? undefined,
    startTime: row.start_time ? row.start_time.slice(0, 5) : undefined,
    endTime: row.end_time ? row.end_time.slice(0, 5) : undefined,
    color: row.color,
    invitees: (row.calendar_entry_invites ?? []).map((i) => single(i.user)).filter(Boolean),
    createdAt: row.created_at,
    recurrence: (row.recurrence ?? undefined) as CalendarEntry['recurrence'],
    completed: row.completed ?? false,
    meetingLink: row.meeting_link ?? undefined,
  }
}

async function setInvites(entryId: string, userIds: string[]): Promise<string | null> {
  const { error: delErr } = await supabase.from('calendar_entry_invites').delete().eq('entry_id', entryId)
  if (delErr) return delErr.message
  if (userIds.length > 0) {
    const { error: insErr } = await supabase
      .from('calendar_entry_invites')
      .insert(userIds.map((userId) => ({ entry_id: entryId, user_id: userId })))
    if (insErr) return insErr.message
  }
  return null
}

export const useCalendarEntriesStore = create<CalendarEntriesState>()(
  persist(
    (set, get) => ({
      entries: [],
      deletedEntryIds: [],
      hiddenOccurrences: [],
      loading: false,
      error: null,

      fetchEntries: async () => {
        set({ loading: true, error: null })
        const deleted = new Set([...get().deletedEntryIds, ...pendingDeletes])

        const { data, error } = await supabase
          .from('calendar_entries')
          .select('*, owner:profiles!calendar_entries_owner_id_fkey(*), calendar_entry_invites(user:profiles(*))')
          .order('date', { ascending: true })

        if (error) {
          set({ loading: false, error: error.message })
          return
        }

        const remote = ((data ?? []) as unknown as CalendarEntryRow[]).map(toEntry)
        const remoteIds = new Set(remote.map((e) => e.id))

        for (const id of deleted) {
          if (remoteIds.has(id)) {
            void supabase.from('calendar_entry_invites').delete().eq('entry_id', id)
            void supabase.from('calendar_entries').delete().eq('id', id)
          }
        }

        const entries = remote.filter((e) => !deleted.has(e.id))

        set({
          entries,
          loading: false,
          deletedEntryIds: get().deletedEntryIds.filter((id) => remoteIds.has(id)),
        })
      },

      addEntry: async (input) => {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (!userId) return 'Nicht angemeldet'

        const { data, error } = await supabase
          .from('calendar_entries')
          .insert({
            owner_id: userId,
            type: input.type,
            title: input.title,
            description: input.description ?? null,
            date: input.date,
            end_date: input.endDate ?? null,
            start_time: input.startTime ?? null,
            end_time: input.endTime ?? null,
            color: input.color,
            recurrence: input.recurrence ?? null,
            meeting_link: input.meetingLink ?? null,
          })
          .select('id')
          .single()

        if (error) {
          console.error('[addEntry] Supabase error:', error.code, error.message, error.details, error.hint)
          return error.message
        }

        if (input.invitedUserIds.length > 0) {
          const inviteErr = await setInvites(data.id, input.invitedUserIds)
          if (inviteErr) console.error('[addEntry] setInvites error:', inviteErr)
        }

        await get().fetchEntries()
        return null
      },

      updateEntry: async (id, input) => {
        const { dbId } = parseCalendarEntryId(id)
        const { error } = await supabase
          .from('calendar_entries')
          .update({
            type: input.type,
            title: input.title,
            description: input.description ?? null,
            date: input.date,
            end_date: input.endDate ?? null,
            start_time: input.startTime ?? null,
            end_time: input.endTime ?? null,
            color: input.color,
            recurrence: input.recurrence ?? null,
            meeting_link: input.meetingLink ?? null,
          })
          .eq('id', dbId)

        if (error) return error.message

        await setInvites(dbId, input.invitedUserIds)
        await get().fetchEntries()
        return null
      },

      toggleCompleted: async (id) => {
        const { dbId } = parseCalendarEntryId(id)
        const entry = get().entries.find((e) => e.id === dbId)
        if (!entry) return
        const next = !entry.completed
        set((state) => ({
          entries: state.entries.map((e) => (e.id === dbId ? { ...e, completed: next } : e)),
        }))
        const { error } = await supabase.from('calendar_entries').update({ completed: next }).eq('id', dbId)
        if (error) await get().fetchEntries()
      },

      rescheduleEntry: async (id, patch) => {
        const { dbId } = parseCalendarEntryId(id)
        const payload: Record<string, unknown> = {}
        if (patch.date !== undefined) payload.date = patch.date
        if (patch.endDate !== undefined) payload.end_date = patch.endDate
        if (patch.startTime !== undefined) payload.start_time = patch.startTime
        if (patch.endTime !== undefined) payload.end_time = patch.endTime
        set((state) => ({
          entries: state.entries.map((e) =>
            e.id === dbId
              ? {
                  ...e,
                  date: patch.date ?? e.date,
                  endDate: patch.endDate === null ? undefined : patch.endDate ?? e.endDate,
                  startTime: patch.startTime === null ? undefined : patch.startTime ?? e.startTime,
                  endTime: patch.endTime === null ? undefined : patch.endTime ?? e.endTime,
                }
              : e
          ),
        }))
        const { error } = await supabase.from('calendar_entries').update(payload).eq('id', dbId)
        if (error) await get().fetchEntries()
      },

      deleteEntry: async (id, occurrenceDate) => {
        const { dbId, isVirtual } = parseCalendarEntryId(id)

        if (isVirtual && occurrenceDate) {
          const key = occurrenceKey(dbId, occurrenceDate)
          set((state) => ({
            hiddenOccurrences: state.hiddenOccurrences.includes(key)
              ? state.hiddenOccurrences
              : [...state.hiddenOccurrences, key],
          }))
          return
        }

        pendingDeletes.add(dbId)
        set((state) => ({
          entries: state.entries.filter((e) => e.id !== dbId),
          deletedEntryIds: state.deletedEntryIds.includes(dbId)
            ? state.deletedEntryIds
            : [...state.deletedEntryIds, dbId],
          hiddenOccurrences: state.hiddenOccurrences.filter((k) => !k.startsWith(`${dbId}:`)),
        }))

        await supabase.from('calendar_entry_invites').delete().eq('entry_id', dbId)
        const { error } = await supabase.from('calendar_entries').delete().eq('id', dbId)
        pendingDeletes.delete(dbId)

        if (error) {
          console.error('[deleteEntry] failed:', error.message)
          await get().fetchEntries()
        }
      },

      undoDelete: (_id) => { /* no-op: immediate delete */ },

      subscribeToEntries: () => {
        const channel = supabase
          .channel('calendar-entries-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_entries' }, () => get().fetchEntries())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_entry_invites' }, () => get().fetchEntries())
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      },
    }),
    {
      name: 'flowdo-calendar-entries',
      partialize: (state) => ({
        deletedEntryIds: state.deletedEntryIds,
        hiddenOccurrences: state.hiddenOccurrences,
      }),
    }
  )
)
