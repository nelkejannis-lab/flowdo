import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Rolling averages per tag/project for AI-assisted time estimates (minutes). */
interface AiDurationState {
  /** tag or "board:{id}" → average actual minutes */
  averages: Record<string, number>
  /** User-adjustable multiplier (1.0 = no adjustment) */
  multiplier: number
  recordActual: (key: string, estimatedMinutes: number | undefined, actualMinutes: number) => void
  suggestMinutes: (key: string, fallback?: number) => number | undefined
  setMultiplier: (v: number) => void
}

function blend(prev: number | undefined, next: number): number {
  if (prev === undefined) return next
  return Math.round(prev * 0.7 + next * 0.3)
}

export const useAiDurationStore = create<AiDurationState>()(
  persist(
    (set, get) => ({
      averages: {},
      multiplier: 1,

      recordActual: (key, estimatedMinutes, actualMinutes) => {
        set((s) => ({
          averages: {
            ...s.averages,
            [key]: blend(s.averages[key], actualMinutes),
          },
        }))
        if (estimatedMinutes && estimatedMinutes > 0) {
          const ratio = actualMinutes / estimatedMinutes
          set((s) => ({
            multiplier: Math.round((s.multiplier * 0.9 + ratio * 0.1) * 100) / 100,
          }))
        }
      },

      suggestMinutes: (key, fallback) => {
        const avg = get().averages[key]
        if (avg === undefined) return fallback
        return Math.max(5, Math.round(avg * get().multiplier))
      },

      setMultiplier: (multiplier) => set({ multiplier: Math.max(0.25, Math.min(3, multiplier)) }),
    }),
    { name: 'flowdo-ai-duration' }
  )
)

export function taskDurationKey(task: { boardId?: string; tags?: string[] }): string {
  if (task.boardId) return `board:${task.boardId}`
  const tag = task.tags?.[0]
  return tag ? `tag:${tag}` : 'general'
}
