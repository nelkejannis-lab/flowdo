import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkDayEntry, WorkTimeSettings } from '../types'
import { todayISO } from '../utils/date'

const defaultSettings: WorkTimeSettings = {
  weeklyHours: 38.5,
  workDaysPerWeek: 5,
  defaultBreakMinutes: 45,
}

interface WorkTimeState {
  settings: WorkTimeSettings
  entries: Record<string, WorkDayEntry>
  isRunning: boolean
  runningStartedAt?: string
  runningDate?: string
  settledWeekendDays: number
  clockIn: () => void
  clockOut: () => void
  setWorkedMinutes: (date: string, minutes: number) => void
  setBreakMinutes: (date: string, minutes: number) => void
  updateSettings: (updates: Partial<WorkTimeSettings>) => void
  incrementSettledWeekendDays: () => void
  decrementSettledWeekendDays: () => void
}

function ensureEntry(
  entries: Record<string, WorkDayEntry>,
  date: string,
  defaultBreakMinutes: number
): WorkDayEntry {
  return entries[date] ?? { date, workedMinutes: 0, breakMinutes: defaultBreakMinutes }
}

export const useWorkTimeStore = create<WorkTimeState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      entries: {},
      isRunning: false,
      runningStartedAt: undefined,
      runningDate: undefined,
      settledWeekendDays: 0,

      clockIn: () => {
        if (get().isRunning) return
        set({ isRunning: true, runningStartedAt: new Date().toISOString(), runningDate: todayISO() })
      },

      clockOut: () => {
        const state = get()
        if (!state.isRunning || !state.runningStartedAt || !state.runningDate) return
        const elapsedMinutes = Math.round((Date.now() - new Date(state.runningStartedAt).getTime()) / 60000)
        const date = state.runningDate
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        set({
          entries: {
            ...state.entries,
            [date]: { ...entry, workedMinutes: entry.workedMinutes + Math.max(0, elapsedMinutes) },
          },
          isRunning: false,
          runningStartedAt: undefined,
          runningDate: undefined,
        })
      },

      setWorkedMinutes: (date, minutes) => {
        set((state) => {
          const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
          return { entries: { ...state.entries, [date]: { ...entry, workedMinutes: Math.max(0, minutes) } } }
        })
      },

      setBreakMinutes: (date, minutes) => {
        set((state) => {
          const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
          return { entries: { ...state.entries, [date]: { ...entry, breakMinutes: Math.max(0, minutes) } } }
        })
      },

      updateSettings: (updates) => set((state) => ({ settings: { ...state.settings, ...updates } })),

      incrementSettledWeekendDays: () =>
        set((state) => ({ settledWeekendDays: state.settledWeekendDays + 1 })),

      decrementSettledWeekendDays: () =>
        set((state) => ({ settledWeekendDays: Math.max(0, state.settledWeekendDays - 1) })),
    }),
    { name: 'flowdo-worktime' }
  )
)
