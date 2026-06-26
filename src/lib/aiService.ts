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

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
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

export async function translateMeeting(summary: string, transcript: string): Promise<{ summary: string; transcript: string }> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('Anthropic API Key (VITE_ANTHROPIC_API_KEY) ist nicht gesetzt.')

  const anthropic = new Anthropic({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true,
  })

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

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
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
      summary: result.summary || summary,
      transcript: result.transcript || transcript
    }
  } catch (error) {
    console.error('Failed to parse Anthropic JSON:', error)
    throw new Error('Übersetzung fehlgeschlagen.')
  }
}
