export class AudioRecorder {
  private audioContext: AudioContext | null = null
  private mixedStream: MediaStream | null = null
  private processor: ScriptProcessorNode | null = null
  private isRecording: boolean = false
  private worker: Worker | null = null
  
  public onTranscriptChunk?: (text: string) => void
  public onError?: (error: string) => void
  public onWorkerLoaded?: () => void
  public onAudioLevel?: (level: number) => void

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

      // Initialize Web Worker
      this.worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e) => {
        const msg = e.data
        if (msg.type === 'loaded') {
          if (this.onWorkerLoaded) this.onWorkerLoaded()
        } else if (msg.type === 'transcription') {
          if (msg.text.trim() && this.onTranscriptChunk && this.isRecording) {
            this.onTranscriptChunk(msg.text.trim())
          }
        } else if (msg.type === 'error') {
          if (this.onError && this.isRecording) this.onError(msg.error)
        }
      }
      
      // Load model immediately
      this.worker.postMessage({ type: 'load' })

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
        if (this.onAudioLevel) {
          let sumSquares = 0
          for (let i = 0; i < channelData.length; i++) sumSquares += channelData[i] * channelData[i]
          const rms = Math.sqrt(sumSquares / channelData.length)
          this.onAudioLevel(Math.min(1, rms * 8))
        }
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
          
          if (this.worker) {
            let sumSquares = 0;
            for (let i = 0; i < merged.length; i++) {
              sumSquares += merged[i] * merged[i];
            }
            let rms = Math.sqrt(sumSquares / merged.length);
            if (rms > 0.03) { // Stricter RMS threshold filters out loud laptop fans and static
              this.worker.postMessage({ type: 'transcribe', audioData: merged })
            }
          }
        }
      }

    } catch (error: any) {
      if (this.onError) this.onError('Fehler beim Starten der Aufnahme: ' + error.message)
      this.stop()
    }
  }

  stop() {
    this.isRecording = false
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
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
