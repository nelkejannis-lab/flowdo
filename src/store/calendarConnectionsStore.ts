import { create } from 'zustand'
import { friendlyCalendarErrors, friendlyUserError } from '../lib/friendlyErrors'
import { supabase } from '../lib/supabase'

export interface CalendarConnection {
  id: string
  provider: 'google' | 'microsoft' | 'ical'
  email: string | null
  displayName: string | null
  lastSyncedAt: string | null
}

export interface TeamsPushEntry {
  id?: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  meetingLink?: string
  externalId?: string
}

export type TeamsPushResult = { error: string | null; externalId?: string | null }

interface CalendarConnectionsState {
  connections: CalendarConnection[]
  syncing: boolean
  fetch: () => Promise<void>
  disconnect: (provider: string) => Promise<void>
  connectIcal: (url: string) => Promise<string | null>
  sync: () => Promise<{ synced: string[]; errors: string[]; cancelled?: number }>
  pushEntryToTeams: (entry: TeamsPushEntry) => Promise<TeamsPushResult>
  updateEntryOnTeams: (entry: TeamsPushEntry) => Promise<TeamsPushResult>
  deleteEntryOnTeams: (externalId: string) => Promise<string | null>
  startOAuth: (provider: 'google' | 'microsoft') => Promise<void>
}

async function callTeamsAction(
  action: 'push' | 'update' | 'delete',
  entry?: TeamsPushEntry,
  externalId?: string,
): Promise<TeamsPushResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { error: friendlyUserError('not authenticated', 'Nicht angemeldet.', 'Not signed in.') }
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/calendar-sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, entry, externalId }),
    })
    const json = await res.json().catch(() => ({})) as { error?: string; externalId?: string }
    if (!res.ok || json.error) {
      return {
        error: friendlyUserError(
          json.error ?? `Microsoft-Fehler (${res.status})`,
          'Microsoft-Kalender konnte nicht aktualisiert werden.',
        ),
      }
    }
    return { error: null, externalId: json.externalId ?? null }
  } catch (err) {
    return {
      error: friendlyUserError(err, 'Verbindung zu Microsoft fehlgeschlagen — bitte später erneut versuchen.'),
    }
  }
}

export const useCalendarConnectionsStore = create<CalendarConnectionsState>()((set, get) => ({
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
    if (!userId) return friendlyUserError('not authenticated', 'Nicht angemeldet.', 'Not signed in.')

    if (!url.startsWith('http') && !url.startsWith('webcal')) {
      return friendlyUserError('invalid url', 'Ungültige Kalender-URL.', 'Invalid calendar URL.')
    }

    const normalizedUrl = url.replace(/^webcal:\/\//, 'https://')

    const { error } = await supabase.from('calendar_connections').upsert({
      user_id: userId,
      provider: 'ical',
      ical_url: normalizedUrl,
      display_name: 'iCal / iCloud',
    }, { onConflict: 'user_id,provider' })

    if (error) return friendlyUserError(error.message, 'Kalender konnte nicht hinzugefügt werden.')

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

    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/calendar-sync`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      const result = (await res.json().catch(() => ({}))) as {
        synced?: string[]
        errors?: string[]
        cancelled?: number
        error?: string
      }
      set({ syncing: false })
      if (!res.ok) {
        return {
          synced: [],
          errors: [
            friendlyUserError(
              result.error || `HTTP ${res.status}`,
              'Kalender konnte nicht synchronisiert werden.',
            ),
          ],
        }
      }
      return {
        synced: result.synced ?? [],
        errors: friendlyCalendarErrors(result.errors ?? []),
        cancelled: result.cancelled,
      }
    } catch (err) {
      set({ syncing: false })
      return {
        synced: [],
        errors: [friendlyUserError(err, 'Kalender konnte nicht synchronisiert werden.')],
      }
    }
  },

  pushEntryToTeams: async (entry) => {
    const msConn = get().connections.find((c) => c.provider === 'microsoft')
    if (!msConn) {
      return {
        error: friendlyUserError(
          'Microsoft/Teams not connected',
          'Microsoft/Outlook ist nicht verbunden.',
          'Microsoft/Outlook is not connected.',
        ),
      }
    }
    return callTeamsAction('push', entry)
  },

  updateEntryOnTeams: async (entry) => {
    const msConn = get().connections.find((c) => c.provider === 'microsoft')
    if (!msConn) {
      return {
        error: friendlyUserError(
          'Microsoft/Teams not connected',
          'Microsoft/Outlook ist nicht verbunden.',
          'Microsoft/Outlook is not connected.',
        ),
      }
    }
    if (entry.externalId) return callTeamsAction('update', entry)
    return callTeamsAction('push', entry)
  },

  deleteEntryOnTeams: async (externalId) => {
    const msConn = get().connections.find((c) => c.provider === 'microsoft')
    if (!msConn) return null
    const result = await callTeamsAction('delete', undefined, externalId)
    return result.error
  },
}))
