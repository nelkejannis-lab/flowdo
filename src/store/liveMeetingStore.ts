import { create } from 'zustand'
import { AudioRecorder } from '../lib/audioRecorder'
import { generateMeetingSummary } from '../lib/aiService'
import {
  estimateMeetingAiCostUsd,
  getMeetingAiQuality,
  getMeetingAiSettings,
  setMeetingAiQuality,
  type MeetingAiQuality,
} from '../lib/meetingAiConfig'
import { ActionItem } from './meetingsStore'

interface LiveMeetingState {
  isRecording: boolean
  transcript: string
  summary: string
  actionItems: ActionItem[]
  isSummarizing: boolean
  error: string | null
  recorder: AudioRecorder | null
  analysisInterval: ReturnType<typeof setInterval> | null
  lastAnalyzedTextLength: number
  analysisCount: number
  aiQuality: MeetingAiQuality
  workerReady: boolean

  startRecording: () => Promise<void>
  stopRecording: () => void
  triggerAnalysis: (isFinal?: boolean) => Promise<void>
  setTranscript: (text: string) => void
  setAiQuality: (quality: MeetingAiQuality) => void
  reset: () => void
}

function mergeActionItems(
  existing: ActionItem[],
  incoming: { task: string; assignee?: string; dueDate?: string }[],
): ActionItem[] {
  const byTask = new Map(existing.map((item) => [item.task.toLowerCase().trim(), item]))

  for (const item of incoming) {
    const key = item.task.toLowerCase().trim()
    if (!key) continue
    const prev = byTask.get(key)
    if (prev) {
      byTask.set(key, {
        ...prev,
        assignee: item.assignee || prev.assignee,
        dueDate: item.dueDate || prev.dueDate,
      })
    } else {
      byTask.set(key, {
        id: crypto.randomUUID(),
        task: item.task,
        assignee: item.assignee,
        dueDate: item.dueDate,
        done: false,
      })
    }
  }

  return Array.from(byTask.values())
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
  analysisCount: 0,
  aiQuality: getMeetingAiQuality(),
  workerReady: false,

  setAiQuality: (quality) => {
    setMeetingAiQuality(quality)
    set({ aiQuality: quality })
  },

  startRecording: async () => {
    get().reset()

    try {
      const recorder = new AudioRecorder()
      recorder.onTranscriptChunk = (chunk) => {
        set((state) => ({
          transcript: state.transcript + (state.transcript ? ' ' : '') + chunk,
        }))
      }
      recorder.onWorkerLoaded = () => set({ workerReady: true })
      recorder.onError = (err) => {
        set({ error: err })
        get().stopRecording()
      }

      await recorder.start()

      const settings = getMeetingAiSettings(get().aiQuality)
      const interval = setInterval(() => {
        const { transcript, lastAnalyzedTextLength, isSummarizing } = get()
        if (isSummarizing) return
        if (transcript.length - lastAnalyzedTextLength >= settings.minNewChars) {
          void get().triggerAnalysis(false)
        }
      }, settings.analysisIntervalMs)

      set({
        isRecording: true,
        recorder,
        analysisInterval: interval,
        error: null,
        aiQuality: getMeetingAiQuality(),
      })
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Aufnahme fehlgeschlagen' })
    }
  },

  stopRecording: () => {
    const { recorder, analysisInterval } = get()
    if (recorder) recorder.stop()
    if (analysisInterval) clearInterval(analysisInterval)

    set({ isRecording: false, recorder: null, analysisInterval: null, workerReady: false })
    void get().triggerAnalysis(true)
  },

  triggerAnalysis: async (isFinal = false) => {
    const state = get()
    const { transcript, lastAnalyzedTextLength, isSummarizing, summary, actionItems, aiQuality } =
      state

    if (isSummarizing) return
    if (transcript.length < 50) return

    const newChars = transcript.length - lastAnalyzedTextLength
    const settings = getMeetingAiSettings(aiQuality)
    if (!isFinal && newChars < settings.minNewChars) return

    set({ isSummarizing: true })
    try {
      const newChunk =
        lastAnalyzedTextLength > 0 ? transcript.slice(lastAnalyzedTextLength).trim() : undefined

      const result = await generateMeetingSummary({
        fullTranscript: transcript,
        previousSummary: summary || undefined,
        newChunk,
        existingActionItems: actionItems.map(({ task, assignee, dueDate }) => ({
          task,
          assignee,
          dueDate,
        })),
        isFinal,
        quality: aiQuality,
      })

      set({
        summary: result.summary,
        actionItems: mergeActionItems(actionItems, result.actionItems),
        lastAnalyzedTextLength: transcript.length,
        analysisCount: state.analysisCount + 1,
      })
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'Analyse fehlgeschlagen' })
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
      lastAnalyzedTextLength: 0,
      analysisCount: 0,
      workerReady: false,
      isSummarizing: false,
      aiQuality: getMeetingAiQuality(),
    })
  },
}))

export function getLiveMeetingCostEstimate(): string {
  const { analysisCount, aiQuality } = useLiveMeetingStore.getState()
  const usd = estimateMeetingAiCostUsd(analysisCount, aiQuality)
  if (analysisCount === 0) return ''
  return usd < 0.01 ? '< $0.01' : `~$${usd.toFixed(2)}`
}
