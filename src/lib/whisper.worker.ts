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
      const result = await transcriber(audioData)
      self.postMessage({ type: 'transcription', text: result.text || '' })
    }
  } catch (err: any) {
    self.postMessage({ type: 'error', error: err.message })
  }
}
