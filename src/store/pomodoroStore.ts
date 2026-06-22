import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { todayISO } from '../utils/date'

export type Phase = 'focus' | 'short' | 'long'

export const DURATIONS: Record<Phase, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
}

interface PomodoroState {
  phase: Phase
  timeLeft: number
  running: boolean
  activeTaskId: string | null
  activeTaskType: 'personal' | 'project' | null
  sessions: number
  setPhase: (phase: Phase) => void
  setTimeLeft: (time: number) => void
  setRunning: (running: boolean) => void
  setActiveTask: (id: string | null, type?: 'personal' | 'project' | null) => void
  incrementSessions: () => void
  reset: () => void
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      phase: 'focus',
      timeLeft: DURATIONS.focus,
      running: false,
      activeTaskId: null,
      activeTaskType: null,
      sessions: (() => {
        try {
          const today = todayISO()
          return parseInt(localStorage.getItem(`pomodoro_sessions_${today}`) ?? '0', 10)
        } catch {
          return 0
        }
      })(),

      setPhase: (phase) => set({ phase, timeLeft: DURATIONS[phase], running: false }),
      setTimeLeft: (timeLeft) => set({ timeLeft }),
      setRunning: (running) => set({ running }),
      setActiveTask: (activeTaskId, activeTaskType = 'personal') => set({ activeTaskId, activeTaskType }),
      incrementSessions: () => {
        const today = todayISO()
        const next = get().sessions + 1
        localStorage.setItem(`pomodoro_sessions_${today}`, String(next))
        set({ sessions: next })
      },
      reset: () => set((s) => ({ timeLeft: DURATIONS[s.phase], running: false })),
    }),
    {
      name: 'flowdo-pomodoro-global',
      version: 1,
    }
  )
)
