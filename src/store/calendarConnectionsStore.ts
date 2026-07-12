import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface CalendarConnection {
  id: string
  provider: 'google' | 'microsoft' | 'ical'
  email: string | null
  displayName: string | null
  lastSyncedAt: string | null
}

interface CalendarConnectionsState {
  connections: CalendarConnection[]
  syncing: boolean
  fetch: () => Promise<void>
  disconnect: (provider: string) => Promise<void>
  connectIcal: (url: string) => Promise<string | null>
  sync: () => Promise<{ synced: string[]; errors: string[] }>
  startOAuth: (provider: 'google' | 'microsoft') => Promise<void>
}

export const useCalendarConnectionsStore = create<CalendarConnectionsState>()((set) => ({
  connections: [],
  syncing: false,

  fetch: async () => {
    const { data } = await supabase
      .from('calendar_connections')
      .select('id, provider, email, display_name, last_synced_at')
      .order('created_at', { ascending: true })

    if (data) {
      set({
        connections: data.map((c: Record<string, string | null>) => ({
          id: c.id as string,
          provider: c.provider as CalendarConnection['provider'],
          email: c.email,
          displayName: c.display_name,
          lastSyncedAt: c.last_synced_at,
        })),
      })
    }
  },

  disconnect: async (provider) => {
    await supabase.from('calendar_connections').delete().eq('provider', provider)
    set((s) => ({ connections: s.connections.filter((c) => c.provider !== provider) }))
  },

  connectIcal: async (url) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return 'Nicht angemeldet'

    if (!url.startsWith('http') && !url.startsWith('webcal')) return 'Ungültige URL'

    const normalizedUrl = url.replace(/^webcal:\/\//, 'https://')

    const { error } = await supabase.from('calendar_connections').upsert({
      user_id: userId,
      provider: 'ical',
      ical_url: normalizedUrl,
      display_name: 'iCal / iCloud',
    }, { onConflict: 'user_id,provider' })

    if (error) return error.message

    set((s) => ({
      connections: [
        ...s.connections.filter((c) => c.provider !== 'ical'),
        { id: 'ical', provider: 'ical', email: null, displayName: 'iCal / iCloud', lastSyncedAt: null },
      ],
    }))
    return null
  },

  startOAuth: async (provider) => {
    const { data, error } = await supabase.functions.invoke('calendar-oauth-start', {
      body: { provider },
    })
    if (error || !data?.redirectUrl) return
    window.location.href = data.redirectUrl as string
  },

  sync: async () => {
    set({ syncing: true })
    const { data: { session } } = await supabase.auth.getSession()
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string

    const res = await fetch(`${supabaseUrl}/functions/v1/calendar-sync`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    const result = await res.json()
    set({ syncing: false })
    return result
  },
}))
