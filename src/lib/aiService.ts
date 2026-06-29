// Meeting AI helpers.
//
// SECURITY: these used to call the Anthropic API directly from the browser with
// `dangerouslyAllowBrowser` and VITE_ANTHROPIC_API_KEY. That bundles the secret API
// key into the web client where anyone can read it — unacceptable for an enterprise
// product. All calls now go through the server-side `ai-chat` Supabase Edge Function,
// which holds the key in `ANTHROPIC_API_KEY` (server env) and never exposes it.

import { supabase } from './supabase'

async function callAi(systemPrompt: string, userMessage: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    },
  })
  if (error) throw new Error(error.message ?? 'KI-Verbindung fehlgeschlagen')
  if (data?.error) throw new Error(typeof data.error === 'string' ? data.error : 'KI-Verbindung fehlgeschlagen')
  return (data?.text as string) ?? ''
}

function extractJson(text: string): any {
  const jsonStart = text.indexOf('{')
  const jsonEnd = text.lastIndexOf('}') + 1
  return JSON.parse(text.slice(jsonStart, jsonEnd))
}

export async function generateMeetingSummary(
  transcript: string
): Promise<{ summary: string; actionItems: { task: string; assignee?: string; dueDate?: string }[] }> {
  const prompt = `
Du bist ein KI-Assistent, der ein laufendes Meeting analysiert.
Hier ist das bisherige Transkript des Meetings:

<transcript>
${transcript}
</transcript>

Deine Aufgabe:
1. Fasse die wichtigsten Punkte STRUKTURIERT und IN STICHPUNKTEN zusammen. Verwende Markdown-Listen (mit Bindestrich "-") für die Zusammenfassung. Schreibe keinen Fließtext, sondern klare Bulletpoints.
2. Extrahiere alle To-Dos und Aufgaben, die erwähnt wurden. Wenn ein Datum oder eine Deadline genannt wird, füge es als "dueDate" hinzu (Format: "TT.MM.JJJJ" oder "Diesen Freitag" etc.).

WICHTIGE REGELN:
- Das Transkript wird live von einer KI (Whisper) erzeugt und in 10-Sekunden-Blöcke zerschnitten. Es IST stark fragmentiert, enthält Grammatikfehler, Halbsätze und Wiederholungen. Das ist völlig normal!
- Du darfst dich NIEMALS über die Qualität, Fragmentierung oder Fehlerhaftigkeit des Transkripts beschweren oder dies in der Zusammenfassung erwähnen.
- Deine Zusammenfassung muss professionell klingen und so tun, als wäre das Transkript perfekt gewesen. Finde den roten Faden und fasse den Inhalt zusammen, egal wie chaotisch der Text ist.
- Die "summary" Eigenschaft im JSON MUSS ein String sein, der Markdown-Stichpunkte enthält (Beispiel: "- Punkt 1\\n- Punkt 2").

Bitte antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "summary": "Deine Zusammenfassung hier...",
  "actionItems": [
    { "task": "Aufgabe 1", "assignee": "Person A (oder leer)", "dueDate": "15.11.2026 (oder leer)" },
    { "task": "Aufgabe 2" }
  ]
}
`

  try {
    const text = await callAi('Du bist ein präziser Meeting-Analyst und antwortest ausschließlich mit JSON.', prompt)
    const result = extractJson(text)
    return {
      summary: result.summary || '',
      actionItems: result.actionItems || [],
    }
  } catch (error) {
    console.error('Failed to generate meeting summary:', error)
    return { summary: 'Fehler beim Erstellen der Zusammenfassung.', actionItems: [] }
  }
}

export async function translateMeeting(
  summary: string,
  transcript: string
): Promise<{ summary: string; transcript: string }> {
  const prompt = `
Please translate the following German meeting summary and transcript into English.
Preserve all formatting (like Markdown bullet points) and keep the exact same structure.

<summary>
${summary}
</summary>

<transcript>
${transcript}
</transcript>

Please reply STRICTLY with valid JSON in the following format:
{
  "summary": "Translated summary here...",
  "transcript": "Translated transcript here..."
}
`

  try {
    const text = await callAi('You are a precise translator and reply strictly with JSON.', prompt)
    const result = extractJson(text)
    return {
      summary: result.summary || summary,
      transcript: result.transcript || transcript,
    }
  } catch (error) {
    console.error('Failed to translate meeting:', error)
    throw new Error('Übersetzung fehlgeschlagen.')
  }
}
