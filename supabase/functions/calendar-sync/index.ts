// Syncs external calendar events into calendar_entries
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
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
  const json = await res.json()
  return json.access_token ?? null
}

async function refreshMicrosoftToken(refreshToken: string): Promise<string | null> {
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
  const json = await res.json()
  return json.access_token ?? null
}

function toISODate(dateStr: string): string {
  return dateStr.split('T')[0]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )
  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401, headers: corsHeaders })

  const { data: connections } = await adminSupabase
    .from('calendar_connections')
    .select('*')
    .eq('user_id', user.id)

  const synced: string[] = []
  const errors: string[] = []

  for (const conn of connections ?? []) {
    try {
      let token = conn.access_token

      // Refresh token if expired
      if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
        if (conn.refresh_token) {
          token = conn.provider === 'google'
            ? await refreshGoogleToken(conn.refresh_token)
            : await refreshMicrosoftToken(conn.refresh_token)

          if (token) {
            await adminSupabase.from('calendar_connections').update({
              access_token: token,
              token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            }).eq('id', conn.id)
          }
        }
      }

      if (!token) { errors.push(`${conn.provider}: kein Token`); continue }

      const now = new Date()
      const fromDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const toDate = new Date(now.getFullYear(), now.getMonth() + 3, 0).toISOString()

      let events: { title: string; date: string; endDate?: string; startTime?: string; endTime?: string }[] = []

      if (conn.provider === 'google') {
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${fromDate}&timeMax=${toDate}&singleEvents=true&maxResults=100`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const json = await res.json()
        events = (json.items ?? []).map((e: Record<string, unknown>) => {
          const start = e.start as Record<string, string>
          const end = e.end as Record<string, string>
          return {
            title: e.summary as string ?? 'Ohne Titel',
            date: start.date ?? toISODate(start.dateTime ?? ''),
            endDate: end.date ?? toISODate(end.dateTime ?? '') ?? undefined,
            startTime: start.dateTime ? start.dateTime.split('T')[1]?.slice(0, 5) : undefined,
            endTime: end.dateTime ? end.dateTime.split('T')[1]?.slice(0, 5) : undefined,
          }
        })
      }

      if (conn.provider === 'microsoft') {
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${fromDate}&endDateTime=${toDate}&$select=subject,start,end&$top=100`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const json = await res.json()
        events = (json.value ?? []).map((e: Record<string, unknown>) => {
          const start = e.start as Record<string, string>
          const end = e.end as Record<string, string>
          return {
            title: e.subject as string ?? 'Ohne Titel',
            date: toISODate(start.dateTime ?? ''),
            endDate: toISODate(end.dateTime ?? '') ?? undefined,
            startTime: start.dateTime?.split('T')[1]?.slice(0, 5),
            endTime: end.dateTime?.split('T')[1]?.slice(0, 5),
          }
        })
      }

      if (conn.provider === 'ical' && conn.ical_url) {
        const res = await fetch(conn.ical_url)
        const icsText = await res.text()
        // Parse basic ICS
        const eventBlocks = icsText.split('BEGIN:VEVENT').slice(1)
        events = eventBlocks.map((block) => {
          const get = (key: string) => block.match(new RegExp(`${key}[^:]*:([^\r\n]+)`))?.[1] ?? ''
          const dtstart = get('DTSTART')
          const dtend = get('DTEND')
          const summary = get('SUMMARY')
          const parseDate = (dt: string) => dt.includes('T') ? dt.slice(0, 10) : dt.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
          const parseTime = (dt: string) => dt.includes('T') ? dt.slice(11, 16) : undefined
          return {
            title: summary || 'Ohne Titel',
            date: parseDate(dtstart),
            endDate: dtend ? parseDate(dtend) : undefined,
            startTime: parseTime(dtstart),
            endTime: dtend ? parseTime(dtend) : undefined,
          }
        }).filter((e) => e.date)
      }

      // Upsert events as calendar_entries with color based on provider
      const color = conn.provider === 'google' ? '#4285F4' : conn.provider === 'microsoft' ? '#0078D4' : '#9B59B6'
      for (const event of events) {
        if (!event.date || !event.title) continue
        await adminSupabase.from('calendar_entries').upsert({
          owner_id: user.id,
          type: 'termin',
          title: `[${conn.provider === 'google' ? 'Google' : conn.provider === 'microsoft' ? 'Outlook' : 'iCal'}] ${event.title}`,
          date: event.date,
          end_date: event.endDate ?? null,
          start_time: event.startTime ?? null,
          end_time: event.endTime ?? null,
          color,
        }, { onConflict: 'owner_id,type,title,date', ignoreDuplicates: true })
      }

      await adminSupabase.from('calendar_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id)
      synced.push(`${conn.provider}: ${events.length} Ereignisse`)
    } catch (err) {
      errors.push(`${conn.provider}: ${err instanceof Error ? err.message : 'Fehler'}`)
    }
  }

  return new Response(JSON.stringify({ synced, errors }), {
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
})
