import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkDayEntry, WorkProfile, WorkTimeSettings } from '../types'
import { createId } from '../utils/id'

const GBM_PROFILE: WorkProfile = {
  id: 'gbm',
  name: 'GBM – Group Brand & Marketing',
  weeklyHours: 38.5,
  workDaysPerWeek: 5,
  defaultBreakMinutes: 45,
  weekdayHours: 8.0,
  fridayHours: 7.25,
}
import { todayISO } from '../utils/date'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { durationBetween } from '../utils/worktime'

const defaultSettings: WorkTimeSettings = {
  weeklyHours: 38.5,
  workDaysPerWeek: 5,
  defaultBreakMinutes: 45,
  weekdayHours: 8.0,
  fridayHours: 7.25,
}

interface WorkTimeSettingsRow {
  weekly_hours: number
  work_days_per_week: number
  default_break_minutes: number
  friday_hours: number | null
  weekday_hours: number | null
  settled_weekend_days: number
  running_started_at: string | null
  running_date: string | null
  profiles_json: string | null
  active_profile_id: string | null
}

interface WorkTimeEntryRow {
  date: string
  worked_minutes: number
  break_minutes: number
  start_time: string | null
  end_time: string | null
  sick_day: boolean | null
}

interface WorkTimeState {
  settings: WorkTimeSettings
  entries: Record<string, WorkDayEntry>
  isRunning: boolean
  runningStartedAt?: string
  runningDate?: string
  settledWeekendDays: number
  manualCompDays: number
  takenCompDays: number
  compensationDaysCount: number
  workProfiles: WorkProfile[]
  activeProfileId?: string
  fetchAll: () => Promise<void>
  clockIn: () => void
  clockOut: () => void
  setWorkedMinutes: (date: string, minutes: number) => void
  setBreakMinutes: (date: string, minutes: number) => void
  setDayTimes: (date: string, startTime: string, endTime: string) => void
  updateSettings: (updates: Partial<WorkTimeSettings>) => void
  addWorkProfile: (profile: Omit<WorkProfile, 'id'>) => void
  deleteWorkProfile: (id: string) => void
  applyWorkProfile: (id: string) => void
  markSickDay: (date: string) => void
  unmarkSickDay: (date: string) => void
  incrementSettledWeekendDays: () => void
  decrementSettledWeekendDays: () => void
  incrementManualCompDays: () => void
  takeCompDay: () => void
  incrementCompensationDays: () => void
  decrementCompensationDays: () => void
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
    start_time: entry.startTime ?? null,
    end_time: entry.endTime ?? null,
    sick_day: entry.sickDay ?? false,
    updated_at: new Date().toISOString(),
  })
}

async function syncSettings(
  settings: WorkTimeSettings,
  settledWeekendDays: number,
  workProfiles?: import('../types').WorkProfile[],
  activeProfileId?: string
) {
  if (!isSupabaseConfigured) return
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await supabase.from('work_time_settings').upsert({
    user_id: userId,
    weekly_hours: settings.weeklyHours,
    work_days_per_week: settings.workDaysPerWeek,
    default_break_minutes: settings.defaultBreakMinutes,
    friday_hours: settings.fridayHours ?? null,
    weekday_hours: settings.weekdayHours ?? null,
    settled_weekend_days: settledWeekendDays,
    profiles_json: workProfiles ? JSON.stringify(workProfiles) : undefined,
    active_profile_id: activeProfileId ?? null,
    updated_at: new Date().toISOString(),
  })
}

async function syncRunningState(runningStartedAt?: string, runningDate?: string) {
  if (!isSupabaseConfigured) return
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await supabase.from('work_time_settings').upsert({
    user_id: userId,
    running_started_at: runningStartedAt ?? null,
    running_date: runningDate ?? null,
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
      manualCompDays: 0,
      takenCompDays: 0,
      compensationDaysCount: 0,
      workProfiles: [GBM_PROFILE],
      activeProfileId: undefined,

      fetchAll: async () => {
        if (!isSupabaseConfigured) return
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (!userId) return

        const [entriesResult, settingsResult] = await Promise.all([
          supabase
            .from('work_time_entries')
            .select('date, worked_minutes, break_minutes, start_time, end_time')
            .eq('user_id', userId),
          supabase.from('work_time_settings').select('*').eq('user_id', userId).maybeSingle(),
        ])

        const rows = (entriesResult.data ?? []) as WorkTimeEntryRow[]
        const entries: Record<string, WorkDayEntry> = {}
        for (const row of rows) {
          entries[row.date] = {
            date: row.date,
            workedMinutes: row.worked_minutes,
            breakMinutes: row.break_minutes,
            startTime: row.start_time ?? undefined,
            endTime: row.end_time ?? undefined,
            sickDay: row.sick_day ?? false,
          }
        }

        const settingsRow = settingsResult.data as WorkTimeSettingsRow | null
        const settings: WorkTimeSettings = settingsRow
          ? {
              weeklyHours: Number(settingsRow.weekly_hours),
              workDaysPerWeek: settingsRow.work_days_per_week,
              defaultBreakMinutes: settingsRow.default_break_minutes,
              fridayHours: settingsRow.friday_hours ?? undefined,
              weekdayHours: settingsRow.weekday_hours ?? undefined,
            }
          : get().settings
        const settledWeekendDays = settingsRow ? settingsRow.settled_weekend_days : get().settledWeekendDays
        const runningStartedAt = settingsRow?.running_started_at ?? undefined
        const runningDate = settingsRow?.running_date ?? undefined

        // Load profiles from Supabase (merged with built-in GBM profile)
        let workProfiles = get().workProfiles
        let activeProfileId = get().activeProfileId
        if (settingsRow?.profiles_json) {
          try {
            const parsed = JSON.parse(settingsRow.profiles_json) as import('../types').WorkProfile[]
            // Always keep GBM built-in, merge with stored custom profiles
            const custom = parsed.filter((p) => p.id !== 'gbm')
            workProfiles = [GBM_PROFILE, ...custom]
          } catch { /* ignore parse errors */ }
        }
        if (settingsRow?.active_profile_id) {
          activeProfileId = settingsRow.active_profile_id
        }

        set({
          entries,
          settings,
          settledWeekendDays,
          isRunning: Boolean(runningStartedAt && runningDate),
          runningStartedAt,
          runningDate,
          workProfiles,
          activeProfileId,
        })

        if (!settingsRow) {
          await syncSettings(settings, settledWeekendDays, get().workProfiles, get().activeProfileId)
        }
      },

      clockIn: () => {
        if (get().isRunning) return
        const runningStartedAt = new Date().toISOString()
        const runningDate = todayISO()
        const startTime = new Date().toTimeString().slice(0, 5)
        const state = get()
        const entry = ensureEntry(state.entries, runningDate, state.settings.defaultBreakMinutes)
        const updated = { ...entry, startTime: entry.startTime ?? startTime }
        set({ isRunning: true, runningStartedAt, runningDate, entries: { ...state.entries, [runningDate]: updated } })
        void syncEntry(updated)
        void syncRunningState(runningStartedAt, runningDate)
      },

      clockOut: () => {
        const state = get()
        if (!state.isRunning || !state.runningStartedAt || !state.runningDate) return
        const elapsedMinutes = Math.round((Date.now() - new Date(state.runningStartedAt).getTime()) / 60000)
        const date = state.runningDate
        const endTime = new Date().toTimeString().slice(0, 5)
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const updated = {
          ...entry,
          workedMinutes: entry.workedMinutes + Math.max(0, elapsedMinutes),
          endTime,
        }
        set({
          entries: { ...state.entries, [date]: updated },
          isRunning: false,
          runningStartedAt: undefined,
          runningDate: undefined,
        })
        void syncEntry(updated)
        void syncRunningState()
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

      setDayTimes: (date, startTime, endTime) => {
        const state = get()
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const duration = durationBetween(startTime, endTime)
        const updated = {
          ...entry,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          workedMinutes: duration ?? entry.workedMinutes,
        }
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

      addWorkProfile: (profile) => {
        const newProfile: WorkProfile = { ...profile, id: createId() }
        set((s) => ({ workProfiles: [...s.workProfiles, newProfile] }))
        const s = get()
        void syncSettings(s.settings, s.settledWeekendDays, s.workProfiles, s.activeProfileId)
      },
      deleteWorkProfile: (id) => {
        set((s) => ({
          workProfiles: s.workProfiles.filter((p) => p.id !== id),
          activeProfileId: s.activeProfileId === id ? undefined : s.activeProfileId,
        }))
        const s = get()
        void syncSettings(s.settings, s.settledWeekendDays, s.workProfiles, s.activeProfileId)
      },
      applyWorkProfile: (id) => {
        const profile = get().workProfiles.find((p) => p.id === id)
        if (!profile) return
        const settings: WorkTimeSettings = {
          ...get().settings,
          weeklyHours: profile.weeklyHours,
          workDaysPerWeek: profile.workDaysPerWeek,
          defaultBreakMinutes: profile.defaultBreakMinutes,
          weekdayHours: profile.weekdayHours,
          fridayHours: profile.fridayHours,
        }
        set({ activeProfileId: id, settings })
        void syncSettings(settings, get().settledWeekendDays, get().workProfiles, id)
      },
      markSickDay: (date) => {
        const state = get()
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const target = (() => {
          const d = new Date(date + 'T12:00:00')
          const dow = d.getDay()
          if (dow === 0 || dow === 6) return 0
          if (dow === 5) return Math.round((state.settings.fridayHours ?? state.settings.weeklyHours / state.settings.workDaysPerWeek) * 60)
          return Math.round((state.settings.weekdayHours ?? state.settings.weeklyHours / state.settings.workDaysPerWeek) * 60)
        })()
        const updated = { ...entry, sickDay: true, workedMinutes: target, breakMinutes: 0, startTime: undefined, endTime: undefined }
        set({ entries: { ...state.entries, [date]: updated } })
        void syncEntry(updated)
      },
      unmarkSickDay: (date) => {
        const state = get()
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const updated = { ...entry, sickDay: false, workedMinutes: 0 }
        set({ entries: { ...state.entries, [date]: updated } })
        void syncEntry(updated)
      },
      incrementManualCompDays: () => set((s) => ({ manualCompDays: s.manualCompDays + 1 })),
      takeCompDay: () => set((s) => ({ takenCompDays: s.takenCompDays + 1 })),
      incrementCompensationDays: () => set((s) => ({ compensationDaysCount: s.compensationDaysCount + 1 })),
      decrementCompensationDays: () => set((s) => ({ compensationDaysCount: Math.max(0, s.compensationDaysCount - 1) })),
    }),
    { name: 'flowdo-worktime' }
  )
)
