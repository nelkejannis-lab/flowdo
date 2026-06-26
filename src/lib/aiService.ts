import { pipeline, env } from '@xenova/transformers'
import Anthropic from '@anthropic-ai/sdk'

// We MUST disable local models so it fetches from Hugging Face instead of our local dev server which returns index.html
env.allowLocalModels = false
env.useBrowserCache = true

let transcriber: any = null

export async function loadWhisperModel() {
  if (!transcriber) {
    // Loads the whisper-tiny model for automatic speech recognition
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny')
  }
}

export async function transcribeAudioChunk(audioBlob: Blob): Promise<string> {
  await loadWhisperModel()

  // Convert Blob to ArrayBuffer
  const arrayBuffer = await audioBlob.arrayBuffer()
  
  // Use AudioContext to decode the webm/audio file to raw PCM (Float32Array at 16kHz)
  const audioContext = new AudioContext({ sampleRate: 16000 })
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
  const audioData = audioBuffer.getChannelData(0) // Float32Array

  const result = await transcriber(audioData)
  return result.text || ''
}

export async function generateMeetingSummary(transcript: string): Promise<{ summary: string; actionItems: { task: string; assignee?: string }[] }> {
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
2. Extrahiere alle To-Dos und Aufgaben, die erwähnt wurden.

Bitte antworte AUSSCHLIESSLICH im folgenden JSON-Format:
{
  "summary": "Deine Zusammenfassung hier...",
  "actionItems": [
    { "task": "Aufgabe 1", "assignee": "Person A (oder leer)" },
    { "task": "Aufgabe 2" }
  ]
}
`

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20240620',
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
