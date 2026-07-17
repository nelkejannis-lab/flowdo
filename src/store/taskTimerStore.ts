import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useTaskTimeStore } from './taskTimeStore'
import { useAuthStore } from './authStore'
import { todayISO } from '../utils/date'

interface TaskTimerState {
  running: boolean
  taskId: string | null
  boardId: string | null
  taskTitle: string | null
  startedAt: number | null
  accumulatedSeconds: number
  start: (taskId: string, boardId: string | null, title: string) => Promise<void>
  pause: () => void
  resume: () => void
  stop: () => Promise<void>
  getElapsedSeconds: () => number
}

export const useTaskTimerStore = create<TaskTimerState>()(
  persist(
    (set, get) => ({
      running: false,
      taskId: null,
      boardId: null,
      taskTitle: null,
      startedAt: null,
      accumulatedSeconds: 0,

      getElapsedSeconds: () => {
        const s = get()
        if (s.running && s.startedAt) {
          return s.accumulatedSeconds + Math.floor((Date.now() - s.startedAt) / 1000)
        }
        return s.accumulatedSeconds
      },

      start: async (taskId, boardId, title) => {
        const cur = get()
        if (cur.taskId === taskId && cur.running) return

        // Switching tasks: persist the previous session first (one active timer).
        if (cur.taskId && cur.taskId !== taskId) {
          await get().stop()
        } else if (cur.taskId === taskId && !cur.running) {
          set({ running: true, startedAt: Date.now(), boardId, taskTitle: title })
          return
        }

        set({
          running: true,
          taskId,
          boardId,
          taskTitle: title,
          startedAt: Date.now(),
          accumulatedSeconds: 0,
        })
      },

      pause: () => {
        const s = get()
        if (!s.running || !s.startedAt) return
        set({
          running: false,
          accumulatedSeconds: s.accumulatedSeconds + Math.floor((Date.now() - s.startedAt) / 1000),
          startedAt: null,
        })
      },

      resume: () => {
        const s = get()
        if (s.running || !s.taskId) return
        set({ running: true, startedAt: Date.now() })
      },

      stop: async () => {
        const s = get()
        if (!s.taskId) return

        const totalSeconds = get().getElapsedSeconds()
        const minutes = Math.max(1, Math.round(totalSeconds / 60))
        const userId = useAuthStore.getState().user?.id

        if (userId && totalSeconds >= 15) {
          await useTaskTimeStore.getState().addEntry({
            taskId: s.taskId,
            boardId: s.boardId ?? undefined,
            ownerId: s.boardId ? undefined : userId,
            userId,
            minutes,
            date: todayISO(),
            note: 'Timer',
          })
        }

        set({
          running: false,
          taskId: null,
          boardId: null,
          taskTitle: null,
          startedAt: null,
          accumulatedSeconds: 0,
        })
      },
    }),
    {
      name: 'flowdo-task-timer',
      partialize: (s) => ({
        running: s.running,
        taskId: s.taskId,
        boardId: s.boardId,
        taskTitle: s.taskTitle,
        startedAt: s.startedAt,
        accumulatedSeconds: s.accumulatedSeconds,
      }),
    }
  )
)
