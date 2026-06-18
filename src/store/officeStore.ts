import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { todayISO } from '../utils/date'

export type OfficeLocation = 'homeoffice' | 'office'

export interface OfficeEntry {
  id: string
  userId: string
  date: string
  location: OfficeLocation
  note?: string
  displayName?: string
  avatarUrl?: string
}

interface OfficeStore {
  todayEntry: OfficeEntry | null
  colleagueEntries: OfficeEntry[]
  promptDismissedDate: string | null
  loading: boolean
  fetchToday: () => Promise<void>
  setLocation: (location: OfficeLocation, note?: string) => Promise<void>
  dismissPrompt: () => void
  shouldShowPrompt: () => boolean
}

export const useOfficeStore = create<OfficeStore>((set, get) => ({
  todayEntry: null,
  colleagueEntries: [],
  promptDismissedDate: null,
  loading: false,

  fetchToday: async () => {
    set({ loading: true })
    const today = todayISO()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { set({ loading: false }); return }

    // Fetch all entries for today (own + colleagues)
    const { data } = await supabase
      .from('office_entries')
      .select('id, user_id, date, location, note')
      .eq('date', today)

    if (!data) { set({ loading: false }); return }

    // Get profile info for all users
    const userIds = [...new Set(data.map((r) => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds)

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

    const entries: OfficeEntry[] = data.map((r) => ({
      id: r.id,
      userId: r.user_id,
      date: r.date,
      location: r.location as OfficeLocation,
      note: r.note ?? undefined,
      displayName: profileMap.get(r.user_id)?.display_name ?? 'Unbekannt',
      avatarUrl: profileMap.get(r.user_id)?.avatar_url ?? undefined,
    }))

    const own = entries.find((e) => e.userId === user.id) ?? null
    const colleagues = entries.filter((e) => e.userId !== user.id)

    set({ todayEntry: own, colleagueEntries: colleagues, loading: false })
  },

  setLocation: async (location, note) => {
    const today = todayISO()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: existing } = await supabase
      .from('office_entries')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('office_entries')
        .update({ location, note: note ?? null })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('office_entries')
        .insert({ user_id: user.id, date: today, location, note: note ?? null })
    }

    await get().fetchToday()
  },

  dismissPrompt: () => {
    set({ promptDismissedDate: todayISO() })
  },

  shouldShowPrompt: () => {
    const today = todayISO()
    const { todayEntry, promptDismissedDate } = get()
    // Don't show on weekends
    const dow = new Date().getDay()
    if (dow === 0 || dow === 6) return false
    // Don't show if already set today
    if (todayEntry?.date === today) return false
    // Don't show if dismissed today
    if (promptDismissedDate === today) return false
    return true
  },
}))
