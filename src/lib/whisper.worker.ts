import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

let transcriber: any = null

async function loadModel() {
  if (!transcriber) {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny')
  }
}

self.onmessage = async (e: MessageEvent) => {
  try {
    const { type, audioData } = e.data
    
    if (type === 'load') {
      await loadModel()
      self.postMessage({ type: 'loaded' })
    } 
    else if (type === 'transcribe') {
      await loadModel()
      const result = await transcriber(audioData, {
        language: 'german',
        task: 'transcribe',
        condition_on_previous_text: false,
        no_speech_threshold: 0.6
      })
      
      let text = result.text || ''
      // Filter out common whisper hallucinations on silence
      const lower = text.toLowerCase()
      if (lower.includes('alright, alright') || lower.includes('i\'ve been doing it for so long') || lower.includes('to me. next time')) {
        text = ''
      }
      
      self.postMessage({ type: 'transcription', text })
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err.message })
  }
}
