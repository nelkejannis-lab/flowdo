import { transcribePCM } from './aiService'

export class AudioRecorder {
  private audioContext: AudioContext | null = null
  private mixedStream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private isRecording: boolean = false
  
  public onTranscriptChunk?: (text: string) => void
  public onError?: (error: string) => void

  async start() {
    try {
      this.isRecording = true
      
      // 1. Get Microphone Audio
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      
      // 2. Get Desktop Audio
      // In Electron, we need to get the desktop source ID first to capture system audio.
      let desktopStream: MediaStream | null = null
      if (window.electronCapturer) {
        const sources = await window.electronCapturer.getDesktopSources()
        const mainSource = sources[0] // usually the entire screen
        
        if (mainSource) {
          desktopStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: mainSource.id,
              }
            } as any,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: mainSource.id,
              }
            } as any
          })
          
          // We only need audio, stop video tracks to save resources
          desktopStream.getVideoTracks().forEach(track => track.stop())
        }
      }

      // 3. Mix the streams using Web Audio API (force 16000Hz for Whisper)
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      const dest = this.audioContext.createMediaStreamDestination()
      
      const micSource = this.audioContext.createMediaStreamSource(micStream)
      micSource.connect(dest)
      
      if (desktopStream && desktopStream.getAudioTracks().length > 0) {
        const desktopSource = this.audioContext.createMediaStreamSource(desktopStream)
        desktopSource.connect(dest)
      }

      this.mixedStream = dest.stream

      // 4. Capture raw PCM data via ScriptProcessor
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      const mixedSource = this.audioContext.createMediaStreamSource(this.mixedStream)
      mixedSource.connect(this.processor)
      this.processor.connect(this.audioContext.destination)

      let audioDataBuffer: Float32Array[] = []
      let samplesCount = 0
      
      // Send to Whisper every 10 seconds
      const SAMPLES_PER_CHUNK = 16000 * 10
      
      this.processor.onaudioprocess = (e) => {
        if (!this.isRecording) return
        
        const channelData = e.inputBuffer.getChannelData(0)
        audioDataBuffer.push(new Float32Array(channelData))
        samplesCount += channelData.length
        
        if (samplesCount >= SAMPLES_PER_CHUNK) {
          const merged = new Float32Array(samplesCount)
          let offset = 0
          for (const buf of audioDataBuffer) {
            merged.set(buf, offset)
            offset += buf.length
          }
          
          audioDataBuffer = []
          samplesCount = 0
          
          transcribePCM(merged).then(text => {
            if (text.trim() && this.onTranscriptChunk && this.isRecording) {
              this.onTranscriptChunk(text.trim())
            }
          }).catch(err => {
            if (this.onError && this.isRecording) this.onError(err.message)
          })
        }
      }

    } catch (error: any) {
      if (this.onError) this.onError('Fehler beim Starten der Aufnahme: ' + error.message)
      this.stop()
    }
  }

  stop() {
    this.isRecording = false
    if (this.processor) {
      this.processor.disconnect()
      this.processor = null
    }
    if (this.mixedStream) {
      this.mixedStream.getTracks().forEach(track => track.stop())
    }
    if (this.audioContext) {
      this.audioContext.close()
    }
  }
}
