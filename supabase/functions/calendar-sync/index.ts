// Syncs external calendar events into calendar_entries + push local Termin to Outlook/Teams
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Provider = 'google' | 'microsoft' | 'ical'

interface SyncEvent {
  externalId: string
  title: string
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
}

interface PushEntry {
  id?: string
  title: string
  date: string
  startTime?: string
  endTime?: string
  meetingLink?: string
  externalId?: string
}

/** Plain URL or JSON { feeds: [{ id, label, url, enabled }] } from NOVAT Apple Calendar settings. */
function parseIcalFeeds(raw: string): { id: string; label: string; url: string }[] {
  const trimmed = (raw || '').trim()
  if (!trimmed) return []
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as { feeds?: { id?: string; label?: string; url?: string; enabled?: boolean }[] }
      if (!Array.isArray(parsed.feeds)) return []
      return parsed.feeds
        .filter((f) => f && f.enabled !== false && typeof f.url === 'string' && f.url.trim())
        .map((f, i) => ({
          id: f.id || `feed-${i}`,
          label: f.label || (f.id === 'private' ? 'Privat' : 'Arbeit'),
          url: f.url!.trim().replace(/^webcal:\/\//i, 'https://'),
        }))
    } catch {
      return []
    }
  }
  return [{ id: 'work', label: 'Arbeit', url: trimmed.replace(/^webcal:\/\//i, 'https://') }]
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

function toISODate(dateStr: string): string {
  return dateStr.split('T')[0]
}

function mapAuthError(raw: string, status?: number): string {
  const lower = raw.toLowerCase()
  if (
    status === 401 ||
    lower.includes('invalid_grant') ||
    lower.includes('expired') ||
    lower.includes('lifetime validation') ||
    lower.includes('token is expired')
  ) {
    return 'Anmeldung abgelaufen — bitte Outlook/Microsoft erneut verbinden.'
  }
  if (
    status === 403 ||
    lower.includes('accessdenied') ||
    lower.includes('insufficient') ||
    lower.includes('forbidden') ||
    lower.includes('authorization_requi')
  ) {
    return 'Keine Kalender-Berechtigung — in Azure „Calendars.ReadWrite“ freigeben und erneut verbinden.'
  }
  if (lower.includes('microsoft not connected') || lower.includes('not connected')) {
    return 'Microsoft/Outlook ist nicht verbunden.'
  }
  if (lower.includes('kein token') || lower.includes('no token')) {
    return 'Kein gültiges Microsoft-Token — bitte Outlook erneut verbinden.'
  }
  return raw.startsWith('{')
    ? 'Microsoft-Kalenderfehler — bitte erneut verbinden oder später erneut versuchen.'
    : raw
}

async function refreshGoogleToken(refreshToken: string): Promise<{ accessToken: string | null; refreshToken?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const jsonBody = await res.json()
  if (!res.ok || jsonBody.error) return { accessToken: null }
  return { accessToken: jsonBody.access_token ?? null, refreshToken: jsonBody.refresh_token }
}

async function refreshMicrosoftToken(refreshToken: string): Promise<{ accessToken: string | null; refreshToken?: string; error?: string }> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('MICROSOFT_CLIENT_ID')!,
      client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
    }),
  })
  const jsonBody = await res.json()
  if (!res.ok || jsonBody.error) {
    return {
      accessToken: null,
      error: mapAuthError(String(jsonBody.error_description ?? jsonBody.error ?? 'token_refresh_failed'), res.status),
    }
  }
  return { accessToken: jsonBody.access_token ?? null, refreshToken: jsonBody.refresh_token }
}

async function ensureMicrosoftToken(
  adminSupabase: ReturnType<typeof createClient>,
  conn: Record<string, unknown>,
): Promise<{ token: string | null; error?: string }> {
  let token = conn.access_token as string | null
  const expired = conn.token_expires_at && new Date(String(conn.token_expires_at)) < new Date()
  if (expired && conn.refresh_token) {
    const refreshed = await refreshMicrosoftToken(String(conn.refresh_token))
    if (!refreshed.accessToken) {
      return { token: null, error: refreshed.error ?? 'Anmeldung abgelaufen — bitte Outlook/Microsoft erneut verbinden.' }
    }
    token = refreshed.accessToken
    const patch: Record<string, unknown> = {
      access_token: token,
      token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    }
    if (refreshed.refreshToken) patch.refresh_token = refreshed.refreshToken
    await adminSupabase.from('calendar_connections').update(patch).eq('id', conn.id)
  }
  if (!token) {
    return { token: null, error: 'Kein gültiges Microsoft-Token — bitte Outlook erneut verbinden.' }
  }
  return { token }
}

function graphEventBody(entry: PushEntry) {
  const start = entry.startTime ? `${entry.date}T${entry.startTime}:00` : `${entry.date}T09:00:00`
  const end = entry.endTime ? `${entry.date}T${entry.endTime}:00` : `${entry.date}T10:00:00`
  return {
    subject: entry.title,
    start: { dateTime: start, timeZone: 'Europe/Berlin' },
    end: { dateTime: end, timeZone: 'Europe/Berlin' },
    body: entry.meetingLink ? { contentType: 'text', content: entry.meetingLink } : undefined,
    isOnlineMeeting: Boolean(entry.meetingLink),
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Nicht angemeldet.' }, 401)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401)

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    const action = body.action as string | undefined

    if (action === 'push' || action === 'update' || action === 'delete') {
      const { data: conn } = await adminSupabase
        .from('calendar_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'microsoft')
        .maybeSingle()

      if (!conn?.access_token) {
        return json({ error: 'Microsoft/Outlook ist nicht verbunden.' }, 400)
      }

      const ensured = await ensureMicrosoftToken(adminSupabase, conn)
      if (!ensured.token) {
        return json({ error: ensured.error ?? 'Anmeldung abgelaufen — bitte Outlook/Microsoft erneut verbinden.' }, 401)
      }
      const token = ensured.token
      const entry = (body.entry ?? {}) as PushEntry
      const externalId = (entry.externalId || body.externalId) as string | undefined

      if (action === 'delete') {
        if (!externalId) return json({ ok: true, skipped: true })
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok && res.status !== 404) {
          const errText = await res.text()
          return json({ error: mapAuthError(errText, res.status) }, res.status >= 400 ? res.status : 400)
        }
        return json({ ok: true })
      }

      if (action === 'update' && externalId) {
        const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(externalId)}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(graphEventBody(entry)),
        })
        if (res.status !== 404) {
          if (!res.ok) {
            const errText = await res.text()
            return json({ error: mapAuthError(errText, res.status) }, res.status >= 400 ? res.status : 400)
          }
          const patched = await res.json()
          if (entry.id) {
            await adminSupabase.from('calendar_entries').update({
              external_id: patched.id ?? externalId,
              external_provider: 'microsoft',
            }).eq('id', entry.id).eq('owner_id', user.id)
          }
          return json({ ok: true, externalId: patched.id ?? externalId })
        }
      }

      const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(graphEventBody(entry)),
      })
      if (!res.ok) {
        const errText = await res.text()
        return json({ error: mapAuthError(errText, res.status) }, res.status >= 400 ? res.status : 400)
      }
      const created = await res.json()
      const newExternalId = created.id as string | undefined
      if (entry.id && newExternalId) {
        await adminSupabase.from('calendar_entries').update({
          external_id: newExternalId,
          external_provider: 'microsoft',
        }).eq('id', entry.id).eq('owner_id', user.id)
      }
      return json({ ok: true, externalId: newExternalId ?? null })
    }
  }

  const { data: connections } = await adminSupabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', user.id)

  const synced: string[] = []
  const errors: string[] = []

  for (const conn of connections ?? []) {
    try {
      let token = conn.access_token as string | null
      const provider = conn.provider as Provider

      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        if (conn.refresh_token) {
          if (provider === 'google') {
            const refreshed = await refreshGoogleToken(conn.refresh_token)
            token = refreshed.accessToken
            if (token) {
              const patch: Record<string, unknown> = {
                access_token: token,
                token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              }
              if (refreshed.refreshToken) patch.refresh_token = refreshed.refreshToken
              await adminSupabase.from('calendar_connections').update(patch).eq('id', conn.id)
            }
          } else if (provider === 'microsoft') {
            const refreshed = await refreshMicrosoftToken(conn.refresh_token)
            token = refreshed.accessToken
            if (token) {
              const patch: Record<string, unknown> = {
                access_token: token,
                token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
              }
              if (refreshed.refreshToken) patch.refresh_token = refreshed.refreshToken
              await adminSupabase.from('calendar_connections').update(patch).eq('id', conn.id)
            } else if (refreshed.error) {
              errors.push(`microsoft: ${refreshed.error}`)
              continue
            }
          }
        }
      }

      if (!token && provider !== 'ical') {
        errors.push(`${provider}: ${mapAuthError('kein Token')}`)
        continue
      }

      const now = new Date()
      const fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const toDate = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString()

      let events: SyncEvent[] = []

      if (provider === 'google' && token) {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${fromDate}&timeMax=${toDate}&singleEvents=true&maxResults=100`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) {
          errors.push(`google: ${mapAuthError(await res.text(), res.status)}`)
          continue
        }
        const jsonBody = await res.json()
        events = (jsonBody.items ?? [])
          .filter((e: Record<string, unknown>) => e.id && e.status !== 'cancelled')
          .map((e: Record<string, unknown>) => {
            const start = e.start as Record<string, string>
            const end = e.end as Record<string, string>
            return {
              externalId: String(e.id),
              title: (e.summary as string) ?? 'Ohne Titel',
              date: start.date ?? toISODate(start.dateTime ?? ''),
              endDate: (end.date ?? toISODate(end.dateTime ?? '')) || undefined,
              startTime: start.dateTime ? start.dateTime.split('T')[1]?.slice(0, 5) : undefined,
              endTime: end.dateTime ? end.dateTime.split('T')[1]?.slice(0, 5) : undefined,
            }
          })
      }

      if (provider === 'microsoft' && token) {
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${fromDate}&endDateTime=${toDate}&$select=id,subject,start,end&$top=100`,
          { headers: { Authorization: `Bearer ${token}` } },
        )
        if (!res.ok) {
          errors.push(`microsoft: ${mapAuthError(await res.text(), res.status)}`)
          continue
        }
        const jsonBody = await res.json()
        events = (jsonBody.value ?? []).map((e: Record<string, unknown>) => {
          const start = e.start as Record<string, string>
          const end = e.end as Record<string, string>
          return {
            externalId: String(e.id),
            title: (e.subject as string) ?? 'Ohne Titel',
            date: toISODate(start.dateTime ?? ''),
            endDate: toISODate(end.dateTime ?? '') || undefined,
            startTime: start.dateTime?.split('T')[1]?.slice(0, 5),
            endTime: end.dateTime?.split('T')[1]?.slice(0, 5),
          }
        })
      }

      if (provider === 'ical' && conn.ical_url) {
        const feeds = parseIcalFeeds(conn.ical_url as string)
        for (const feed of feeds) {
          try {
            const res = await fetch(feed.url)
            if (!res.ok) {
              errors.push(`apple/${feed.id}: HTTP ${res.status}`)
              continue
            }
            const icsText = await res.text()
            const eventBlocks = icsText.split('BEGIN:VEVENT').slice(1)
            const feedEvents = eventBlocks.map((block: string, idx: number) => {
              const get = (key: string) => block.match(new RegExp(`${key}[^:]*:([^\\r\\n]+)`))?.[1] ?? ''
              const dtstart = get('DTSTART')
              const dtend = get('DTEND')
              const summary = get('SUMMARY')
              const uid = get('UID') || `ical-${feed.id}-${idx}-${dtstart}-${summary}`
              const parseDate = (dt: string) =>
                dt.includes('T') ? dt.slice(0, 10) : dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
              const parseTime = (dt: string) => (dt.includes('T') ? dt.slice(11, 16) : undefined)
              const tag = feed.label ? `[Apple ${feed.label}]` : '[Apple]'
              return {
                externalId: `${feed.id}:${uid}`,
                title: `${tag} ${summary || 'Ohne Titel'}`,
                date: parseDate(dtstart),
                endDate: dtend ? parseDate(dtend) : undefined,
                startTime: parseTime(dtstart),
                endTime: dtend ? parseTime(dtend) : undefined,
              }
            }).filter((e: SyncEvent) => Boolean(e.date))
            events.push(...feedEvents)
          } catch (feedErr) {
            errors.push(`apple/${feed.id}: ${feedErr instanceof Error ? feedErr.message : 'Fehler'}`)
          }
        }
      }

      const syncedExternalIds = new Set<string>()
      const color = provider === 'google' ? '#4285F4' : provider === 'microsoft' ? '#0078D4' : '#AF52DE'
      // Apple titles already include [Apple …] from feed parse; keep [iCal] for legacy rows
      const prefix = provider === 'google' ? '[Google]' : provider === 'microsoft' ? '[Outlook]' : '[Apple]'

      for (const event of events) {
        if (!event.date || !event.title || !event.externalId) continue
        syncedExternalIds.add(event.externalId)

        const { data: existing } = await adminSupabase
          .from('calendar_entries')
          .select('id, title')
          .eq('owner_id', user.id)
          .eq('external_provider', provider)
          .eq('external_id', event.externalId)
          .maybeSingle()

        const payload = {
          owner_id: user.id,
          type: 'termin' as const,
          title: (() => {
            if (provider === 'ical') {
              // Feed parse already embeds [Apple …] in the title
              if (existing?.title && !String(existing.title).startsWith('[Apple') && !String(existing.title).startsWith('[iCal')) {
                return existing.title
              }
              return event.title
            }
            return existing?.title?.startsWith(prefix) || !existing
              ? `${prefix} ${event.title}`
              : existing.title
          })(),
          date: event.date,
          end_date: event.endDate ?? null,
          start_time: event.startTime ?? null,
          end_time: event.endTime ?? null,
          color,
          external_id: event.externalId,
          external_provider: provider,
        }

        if (existing?.id) {
          await adminSupabase.from('calendar_entries').update(payload).eq('id', existing.id)
        } else {
          const legacyTitle = event.title
          const { data: legacy } = await adminSupabase
            .from('calendar_entries')
            .select('id')
            .eq('owner_id', user.id)
            .eq('type', 'termin')
            .eq('title', legacyTitle)
            .eq('date', event.date)
            .is('external_id', null)
            .maybeSingle()

          if (legacy?.id) {
            await adminSupabase.from('calendar_entries').update(payload).eq('id', legacy.id)
          } else {
            await adminSupabase.from('calendar_entries').insert(payload)
          }
        }
      }

      const { data: existingImported } = await adminSupabase
        .from('calendar_entries')
        .select('id, title, external_id')
        .eq('owner_id', user.id)
        .eq('external_provider', provider)

      let cancelled = 0
      for (const row of existingImported ?? []) {
        const extId = row.external_id as string | null
        const title = String(row.title ?? '')
        // Only auto-remove imported Apple/iCal or prefixed Google/Outlook rows
        const isImported =
          provider === 'ical'
            ? title.startsWith('[Apple') || title.startsWith('[iCal')
            : title.startsWith(prefix)
        if (!isImported) continue
        if (!extId || !syncedExternalIds.has(extId)) {
          await adminSupabase.from('calendar_entries').delete().eq('id', row.id)
          cancelled++
        }
      }

      await adminSupabase.from('calendar_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id)
      synced.push(`${provider}: ${events.length} events${cancelled ? `, ${cancelled} removed` : ''}`)
    } catch (err) {
      errors.push(`${conn.provider}: ${err instanceof Error ? err.message : 'Fehler'}`)
    }
  }

  return json({ synced, errors })
})
