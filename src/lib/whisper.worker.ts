import { pipeline, env } from '@xenova/transformers'

env.allowLocalModels = false
env.useBrowserCache = true

let transcriber: any = null

async function loadModel() {
  if (!transcriber) {
    transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base')
  }
}

let lastTranscribedText = '';

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
        no_speech_threshold: 0.6,
        repetition_penalty: 1.2
      })
      
      let text = result.text || ''
      
      // Filter out common whisper hallucinations on silence
      const lower = text.toLowerCase().trim()
      if (lower.includes('alright, alright') || lower.includes('i\'ve been doing it for so long') || lower.includes('to me. next time') || lower.includes('untertitelung')) {
        text = ''
      }

      // Strong hallucination filter: if a single short word is repeated 3+ times (e.g. "das das das")
      const words = lower.split(/\s+/)
      let isRepeatingLoop = false
      for (let i = 0; i < words.length - 2; i++) {
        if (words[i] === words[i+1] && words[i+1] === words[i+2]) {
          isRepeatingLoop = true;
          break;
        }
      }
      
      if (isRepeatingLoop) {
        text = ''
      }
      
      // Prevent consecutive exact duplicate chunks
      if (text.trim() && text.trim() === lastTranscribedText) {
        text = ''
      } else if (text.trim()) {
        lastTranscribedText = text.trim()
      }
      
      if (text.trim()) {
        self.postMessage({ type: 'transcription', text: text.trim() })
      }
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err.message })
  }
}
