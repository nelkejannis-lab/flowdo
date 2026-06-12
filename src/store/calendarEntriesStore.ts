import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { CalendarEntry, CalendarEntryInvitee, CalendarEntryType } from '../types'

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
}

interface CalendarEntriesState {
  entries: CalendarEntry[]
  loading: boolean
  error: string | null
  fetchEntries: () => Promise<void>
  addEntry: (input: NewCalendarEntryInput) => Promise<string | null>
  updateEntry: (id: string, input: NewCalendarEntryInput) => Promise<string | null>
  deleteEntry: (id: string) => Promise<void>
}

function single<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value
}

function toEntry(row: CalendarEntryRow): CalendarEntry {
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
  }
}

async function setInvites(entryId: string, userIds: string[]) {
  await supabase.from('calendar_entry_invites').delete().eq('entry_id', entryId)
  if (userIds.length > 0) {
    await supabase
      .from('calendar_entry_invites')
      .insert(userIds.map((userId) => ({ entry_id: entryId, user_id: userId })))
  }
}

export const useCalendarEntriesStore = create<CalendarEntriesState>()((set, get) => ({
  entries: [],
  loading: false,
  error: null,

  fetchEntries: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('calendar_entries')
      .select('*, owner:profiles!calendar_entries_owner_id_fkey(*), calendar_entry_invites(user:profiles(*))')
      .order('date', { ascending: true })

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const entries = ((data ?? []) as unknown as CalendarEntryRow[]).map(toEntry)
    set({ entries, loading: false })
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
      })
      .select('id')
      .single()

    if (error) return error.message

    if (input.invitedUserIds.length > 0) {
      await setInvites(data.id, input.invitedUserIds)
    }

    await get().fetchEntries()
    return null
  },

  updateEntry: async (id, input) => {
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
      })
      .eq('id', id)

    if (error) return error.message

    await setInvites(id, input.invitedUserIds)
    await get().fetchEntries()
    return null
  },

  deleteEntry: async (id) => {
    await supabase.from('calendar_entries').delete().eq('id', id)
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }))
  },
}))
