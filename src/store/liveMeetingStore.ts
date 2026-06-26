import { create } from 'zustand'
import { AudioRecorder } from '../lib/audioRecorder'
import { generateMeetingSummary } from '../lib/aiService'
import { ActionItem } from './meetingsStore'

interface LiveMeetingState {
  isRecording: boolean
  transcript: string
  summary: string
  actionItems: ActionItem[]
  isSummarizing: boolean
  error: string | null
  recorder: AudioRecorder | null
  analysisInterval: any | null
  lastAnalyzedTextLength: number
  
  startRecording: () => Promise<void>
  stopRecording: () => void
  triggerAnalysis: () => Promise<void>
  setTranscript: (text: string) => void
  reset: () => void
}

export const useLiveMeetingStore = create<LiveMeetingState>((set, get) => ({
  isRecording: false,
  transcript: '',
  summary: '',
  actionItems: [],
  isSummarizing: false,
  error: null,
  recorder: null,
  analysisInterval: null,
  lastAnalyzedTextLength: 0,

  startRecording: async () => {
    get().reset()
    
    try {
      const recorder = new AudioRecorder()
      recorder.onTranscriptChunk = (chunk) => {
        set(state => ({ transcript: state.transcript + (state.transcript ? ' ' : '') + chunk }))
      }
      recorder.onError = (err) => {
        set({ error: err })
        get().stopRecording()
      }

      await recorder.start()
      
      const interval = setInterval(() => {
        const currentText = get().transcript
        if (currentText.length - get().lastAnalyzedTextLength > 100) {
          get().triggerAnalysis()
        }
      }, 30000)

      set({ isRecording: true, recorder, analysisInterval: interval, error: null })
    } catch (err: any) {
      set({ error: err.message })
    }
  },

  stopRecording: () => {
    const { recorder, analysisInterval } = get()
    if (recorder) recorder.stop()
    if (analysisInterval) clearInterval(analysisInterval)
    
    set({ isRecording: false, recorder: null, analysisInterval: null })
    get().triggerAnalysis()
  },

  triggerAnalysis: async () => {
    const { transcript, lastAnalyzedTextLength } = get()
    if (transcript.length < 50) return

    set({ isSummarizing: true })
    try {
      const result = await generateMeetingSummary(transcript)
      set({
        summary: result.summary,
        actionItems: result.actionItems.map(ai => ({
          id: crypto.randomUUID(),
          task: ai.task,
          assignee: ai.assignee,
          dueDate: ai.dueDate,
          done: false
        })),
        lastAnalyzedTextLength: transcript.length
      })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isSummarizing: false })
    }
  },

  setTranscript: (text) => set({ transcript: text }),
  
  reset: () => {
    const { recorder, analysisInterval } = get()
    if (recorder) recorder.stop()
    if (analysisInterval) clearInterval(analysisInterval)
    set({
      isRecording: false,
      transcript: '',
      summary: '',
      actionItems: [],
      error: null,
      recorder: null,
      analysisInterval: null,
      lastAnalyzedTextLength: 0
    })
  }
}))
