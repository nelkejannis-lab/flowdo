import { transcribeAudioChunk } from './aiService'

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private mixedStream: MediaStream | null = null
  private chunkInterval: number = 10000 // 10 seconds
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

      // 3. Mix the streams using Web Audio API
      this.audioContext = new AudioContext()
      const dest = this.audioContext.createMediaStreamDestination()
      
      const micSource = this.audioContext.createMediaStreamSource(micStream)
      micSource.connect(dest)
      
      if (desktopStream && desktopStream.getAudioTracks().length > 0) {
        const desktopSource = this.audioContext.createMediaStreamSource(desktopStream)
        desktopSource.connect(dest)
      }

      this.mixedStream = dest.stream

      // 4. Start Recording in chunks
      this.mediaRecorder = new MediaRecorder(this.mixedStream, { mimeType: 'audio/webm' })
      
      this.mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && this.isRecording) {
          try {
            const text = await transcribeAudioChunk(e.data)
            if (text.trim() && this.onTranscriptChunk) {
              this.onTranscriptChunk(text.trim())
            }
          } catch (error: any) {
            if (this.onError) this.onError(error.message)
          }
        }
      }

      // Request data every chunkInterval ms
      this.mediaRecorder.start(this.chunkInterval)

    } catch (error: any) {
      if (this.onError) this.onError('Fehler beim Starten der Aufnahme: ' + error.message)
      this.stop()
    }
  }

  stop() {
    this.isRecording = false
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    if (this.mixedStream) {
      this.mixedStream.getTracks().forEach(track => track.stop())
    }
    if (this.audioContext) {
      this.audioContext.close()
    }
  }
}
