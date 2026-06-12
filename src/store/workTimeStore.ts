import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkDayEntry, WorkTimeSettings } from '../types'
import { todayISO } from '../utils/date'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const defaultSettings: WorkTimeSettings = {
  weeklyHours: 38.5,
  workDaysPerWeek: 5,
  defaultBreakMinutes: 45,
}

interface WorkTimeSettingsRow {
  weekly_hours: number
  work_days_per_week: number
  default_break_minutes: number
  settled_weekend_days: number
}

interface WorkTimeEntryRow {
  date: string
  worked_minutes: number
  break_minutes: number
}

interface WorkTimeState {
  settings: WorkTimeSettings
  entries: Record<string, WorkDayEntry>
  isRunning: boolean
  runningStartedAt?: string
  runningDate?: string
  settledWeekendDays: number
  fetchAll: () => Promise<void>
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

async function syncEntry(entry: WorkDayEntry) {
  if (!isSupabaseConfigured) return
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await supabase.from('work_time_entries').upsert({
    user_id: userId,
    date: entry.date,
    worked_minutes: entry.workedMinutes,
    break_minutes: entry.breakMinutes,
    updated_at: new Date().toISOString(),
  })
}

async function syncSettings(settings: WorkTimeSettings, settledWeekendDays: number) {
  if (!isSupabaseConfigured) return
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await supabase.from('work_time_settings').upsert({
    user_id: userId,
    weekly_hours: settings.weeklyHours,
    work_days_per_week: settings.workDaysPerWeek,
    default_break_minutes: settings.defaultBreakMinutes,
    settled_weekend_days: settledWeekendDays,
    updated_at: new Date().toISOString(),
  })
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

      fetchAll: async () => {
        if (!isSupabaseConfigured) return
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (!userId) return

        const [entriesResult, settingsResult] = await Promise.all([
          supabase.from('work_time_entries').select('date, worked_minutes, break_minutes').eq('user_id', userId),
          supabase.from('work_time_settings').select('*').eq('user_id', userId).maybeSingle(),
        ])

        const rows = (entriesResult.data ?? []) as WorkTimeEntryRow[]
        const entries: Record<string, WorkDayEntry> = {}
        for (const row of rows) {
          entries[row.date] = { date: row.date, workedMinutes: row.worked_minutes, breakMinutes: row.break_minutes }
        }

        const settingsRow = settingsResult.data as WorkTimeSettingsRow | null
        const settings: WorkTimeSettings = settingsRow
          ? {
              weeklyHours: Number(settingsRow.weekly_hours),
              workDaysPerWeek: settingsRow.work_days_per_week,
              defaultBreakMinutes: settingsRow.default_break_minutes,
            }
          : get().settings
        const settledWeekendDays = settingsRow ? settingsRow.settled_weekend_days : get().settledWeekendDays

        set({ entries, settings, settledWeekendDays })

        if (!settingsRow) {
          await syncSettings(settings, settledWeekendDays)
        }
      },

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
        const updated = { ...entry, workedMinutes: entry.workedMinutes + Math.max(0, elapsedMinutes) }
        set({
          entries: { ...state.entries, [date]: updated },
          isRunning: false,
          runningStartedAt: undefined,
          runningDate: undefined,
        })
        void syncEntry(updated)
      },

      setWorkedMinutes: (date, minutes) => {
        const state = get()
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const updated = { ...entry, workedMinutes: Math.max(0, minutes) }
        set({ entries: { ...state.entries, [date]: updated } })
        void syncEntry(updated)
      },

      setBreakMinutes: (date, minutes) => {
        const state = get()
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const updated = { ...entry, breakMinutes: Math.max(0, minutes) }
        set({ entries: { ...state.entries, [date]: updated } })
        void syncEntry(updated)
      },

      updateSettings: (updates) => {
        const settings = { ...get().settings, ...updates }
        set({ settings })
        void syncSettings(settings, get().settledWeekendDays)
      },

      incrementSettledWeekendDays: () => {
        const settledWeekendDays = get().settledWeekendDays + 1
        set({ settledWeekendDays })
        void syncSettings(get().settings, settledWeekendDays)
      },

      decrementSettledWeekendDays: () => {
        const settledWeekendDays = Math.max(0, get().settledWeekendDays - 1)
        set({ settledWeekendDays })
        void syncSettings(get().settings, settledWeekendDays)
      },
    }),
    { name: 'flowdo-worktime' }
  )
)
