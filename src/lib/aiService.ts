// Removed local Whisper transcriber. Whisper logic is now inside src/lib/whisper.worker.ts

import Anthropic from '@anthropic-ai/sdk'

export async function generateMeetingSummary(transcript: string): Promise<{ summary: string; actionItems: { task: string; assignee?: string; dueDate?: string }[] }> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API Key (VITE_ANTHROPIC_API_KEY) ist nicht gesetzt.')

  const anthropic = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true, // We are running inside Electron renderer
  })

  const prompt = `
Du bist ein KI-Assistent, der ein laufendes Meeting analysiert. 
Hier ist das bisherige Transkript des Meetings:

<transcript>
${transcript}
</transcript>

Deine Aufgabe:
1. Fasse die wichtigsten Punkte kurz zusammen.
2. Extrahiere alle To-Dos und Aufgaben, die erwähnt wurden. Wenn ein Datum oder eine Deadline genannt wird, füge es als "dueDate" hinzu (Format: "TT.MM.JJJJ" oder "Diesen Freitag" etc.).

Bitte antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "summary": "Deine Zusammenfassung hier...",
  "actionItems": [
    { "task": "Aufgabe 1", "assignee": "Person A (oder leer)", "dueDate": "15.11.2026 (oder leer)" },
    { "task": "Aufgabe 2" }
  ]
}
`

  const response = await anthropic.messages.create({
    model: 'claude-2.1',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: prompt }
    ]
  })

  try {
    const text = (response.content[0] as any).text
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}') + 1
    const jsonString = text.slice(jsonStart, jsonEnd)
    const result = JSON.parse(jsonString)
    return {
      summary: result.summary || '',
      actionItems: result.actionItems || []
    }
  } catch (error) {
    console.error('Failed to parse Anthropic JSON:', error)
    return { summary: 'Fehler beim Parsen der Zusammenfassung.', actionItems: [] }
  }
}
