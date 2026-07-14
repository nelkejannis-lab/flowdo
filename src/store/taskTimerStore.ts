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
  start: (taskId: string, boardId: string, title: string) => void
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

      start: (taskId, boardId, title) => {
        const cur = get()
        if (cur.running && cur.taskId === taskId) return
        set({
          running: true,
          taskId,
          boardId,
          taskTitle: title,
          startedAt: Date.now(),
          accumulatedSeconds: cur.taskId === taskId ? cur.accumulatedSeconds : 0,
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
        if (!s.taskId || !s.boardId) return

        const totalSeconds = get().getElapsedSeconds()
        const minutes = Math.max(1, Math.round(totalSeconds / 60))
        const userId = useAuthStore.getState().user?.id

        if (userId && minutes > 0) {
          await useTaskTimeStore.getState().addEntry({
            taskId: s.taskId,
            boardId: s.boardId,
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

/** Log pomodoro focus session to project time tracking. */
export async function logPomodoroToProjectTime(taskId: string, boardId: string, minutes: number) {
  const userId = useAuthStore.getState().user?.id
  if (!userId) return
  await useTaskTimeStore.getState().addEntry({
    taskId,
    boardId,
    userId,
    minutes,
    date: todayISO(),
    note: 'Pomodoro',
  })
}
