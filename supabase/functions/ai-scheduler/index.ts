// Supabase Edge Function: proxies appointment-parsing and best-slot-finding to the Anthropic API.

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-3-5-haiku-20241022'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callClaude(apiKey: string, system: string, userMessage: string) {
  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })
  return res
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY ist auf dem Server nicht konfiguriert' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }

  try {
    const body = await req.json()

    // Action: find-best-slot
    if (body.action === 'find-best-slot') {
      const { colleagues, busySlots, fromDate, toDate, durationMinutes, preferredStartTime, preferredEndTime } = body

      const colleagueList = colleagues.map((c: { id: string; name: string }) => `- ${c.name}`).join('\n')
      const busyList = busySlots.length > 0
        ? busySlots.map((s: { userName: string; date: string; endDate?: string; startTime?: string; endTime?: string; title: string }) =>
            `- ${s.userName}: ${s.date}${s.endDate ? ` bis ${s.endDate}` : ''}${s.startTime ? ` ${s.startTime}–${s.endTime ?? '?'}` : ' (ganztags)'} („${s.title}")`
          ).join('\n')
        : '(keine bekannten Termine im Zeitraum)'

      const timeWindow = preferredStartTime && preferredEndTime
        ? `Bevorzugtes Zeitfenster: ${preferredStartTime} bis ${preferredEndTime} Uhr.`
        : 'Kein bevorzugtes Zeitfenster angegeben (nimm Bürozeiten 08:00–18:00 an).'

      const system = `Du findest den besten freien Termin für eine Gruppe von Personen.
Zeitraum: ${fromDate} bis ${toDate}.
Gewünschte Dauer: ${durationMinutes} Minuten.
${timeWindow}

Beteiligte Personen:
${colleagueList}

Bekannte Termine (busy slots) im Zeitraum:
${busyList}

Antworte AUSSCHLIESSLICH mit kompaktem JSON ohne weiteren Text:
{
  "date": "yyyy-MM-dd",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "explanation": "Kurze Begründung warum dieser Slot am besten passt (1 Satz)"
}

Regeln:
- Wähle einen Slot an dem ALLE Personen frei sind.
- Vermeide Überschneidungen mit den busy slots.
- Bevorzuge frühere Termine.
- Arbeite nur innerhalb des angegebenen Zeitraums.`

      const res = await callClaude(apiKey, system, 'Finde den besten gemeinsamen Termin.')
      const json = await res.json()
      return new Response(JSON.stringify(json), {
        status: res.status,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }

    // Default action: parse appointment from text
    const { text, systemPrompt } = body
    if (!text || !systemPrompt) {
      return new Response(JSON.stringify({ error: 'text und systemPrompt sind erforderlich' }), {
        status: 400,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }

    const res = await callClaude(apiKey, systemPrompt, text)
    const json = await res.json()
    return new Response(JSON.stringify(json), {
      status: res.status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unbekannter Fehler' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }
})
