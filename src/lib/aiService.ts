// Meeting AI helpers.
//
// SECURITY: these used to call the Anthropic API directly from the browser with
// `dangerouslyAllowBrowser` and VITE_ANTHROPIC_API_KEY. That bundles the secret API
// key into the web client where anyone can read it — unacceptable for an enterprise
// product. All calls now go through the server-side `ai-chat` Supabase Edge Function,
// which holds the key in `ANTHROPIC_API_KEY` (server env) and never exposes it.

import { supabase } from './supabase'
import { getMeetingAiSettings, type MeetingAiQuality } from './meetingAiConfig'

interface AiCallOptions {
  model?: string
  maxTokens?: number
}

async function callAi(
  systemPrompt: string,
  userMessage: string,
  options: AiCallOptions = {},
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: {
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      model: options.model,
      maxTokens: options.maxTokens,
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

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return text.slice(-maxChars)
}

export interface MeetingSummaryInput {
  fullTranscript: string
  previousSummary?: string
  newChunk?: string
  existingActionItems?: { task: string; assignee?: string; dueDate?: string }[]
  isFinal?: boolean
  quality?: MeetingAiQuality
}

export async function generateMeetingSummary(
  input: MeetingSummaryInput | string,
): Promise<{ summary: string; actionItems: { task: string; assignee?: string; dueDate?: string }[] }> {
  const params: MeetingSummaryInput =
    typeof input === 'string' ? { fullTranscript: input } : input

  const settings = getMeetingAiSettings(params.quality)
  const {
    fullTranscript,
    previousSummary = '',
    newChunk,
    existingActionItems = [],
    isFinal = false,
  } = params

  const incremental = Boolean(previousSummary && newChunk && newChunk.length >= 40)
  const transcriptForPrompt = incremental
    ? truncateText(newChunk!, settings.maxTranscriptChars)
    : truncateText(fullTranscript, settings.maxTranscriptChars)

  const existingItemsJson =
    existingActionItems.length > 0
      ? JSON.stringify(existingActionItems.slice(0, 30))
      : '[]'

  const prompt = incremental
    ? `Aktualisiere die Meeting-Zusammenfassung anhand eines NEUEN Transkript-Abschnitts.

<bisherige_zusammenfassung>
${previousSummary}
</bisherige_zusammenfassung>

<neuer_abschnitt>
${transcriptForPrompt}
</neuer_abschnitt>

<bisherige_action_items>
${existingItemsJson}
</bisherige_action_items>

Regeln:
- Ergänze/aktualisiere die Zusammenfassung (Markdown-Stichpunkte mit "-"). Kein Fließtext.
- Behalte bestehende Punkte, füge Neues hinzu, entferne Duplikate.
- Action Items: alle bisherigen behalten + neue ergänzen, Duplikate zusammenführen.
- dueDate Format: "TT.MM.JJJJ" oder relative Angabe.
- Transkript ist Whisper-Live-Text (fragmentiert) — nicht erwähnen.

Antwort NUR als JSON:
{"summary":"...","actionItems":[{"task":"...","assignee":"","dueDate":""}]}`
    : `Analysiere dieses Meeting-Transkript.

<transcript>
${transcriptForPrompt}
</transcript>

Regeln:
- Zusammenfassung als Markdown-Stichpunkte ("-"), kein Fließtext.
- Action Items mit task, optional assignee/dueDate.
- Whisper-Live-Text ist fragmentiert — Inhalt trotzdem professionell zusammenfassen.

Antwort NUR als JSON:
{"summary":"...","actionItems":[{"task":"...","assignee":"","dueDate":""}]}`

  const systemPrompt = isFinal
    ? 'Präziser Meeting-Analyst. Antwort ausschließlich als valides JSON.'
    : 'Präziser Meeting-Analyst für Live-Updates. Antwort ausschließlich als valides JSON.'

  try {
    const text = await callAi(systemPrompt, prompt, {
      model: settings.model,
      maxTokens: settings.maxTokens,
    })
    const result = extractJson(text)
    return {
      summary: result.summary || previousSummary || '',
      actionItems: result.actionItems || existingActionItems,
    }
  } catch (error) {
    console.error('Failed to generate meeting summary:', error)
    return {
      summary: previousSummary || 'Fehler beim Erstellen der Zusammenfassung.',
      actionItems: existingActionItems,
    }
  }
}

export async function translateMeeting(
  summary: string,
  transcript: string,
): Promise<{ summary: string; transcript: string }> {
  const settings = getMeetingAiSettings('economy')

  const prompt = `Translate this German meeting summary to English. Keep Markdown formatting.

<summary>
${summary}
</summary>

Reply ONLY with JSON: {"summary":"..."}`

  try {
    const text = await callAi('Precise translator. Reply strictly with JSON.', prompt, {
      model: settings.model,
      maxTokens: 1536,
    })
    const result = extractJson(text)
    return {
      summary: result.summary || summary,
      transcript,
    }
  } catch (error) {
    console.error('Failed to translate meeting:', error)
    throw new Error('Übersetzung fehlgeschlagen.')
  }
}
