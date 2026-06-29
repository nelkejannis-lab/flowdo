import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkDayEntry, WorkProfile, WorkTimeSettings, WorkTimePunch, WorkTimeAuditEntry } from '../types'
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
  manual_comp_days: number | null
  taken_comp_days: number | null
}

interface WorkTimeEntryRow {
  date: string
  worked_minutes: number
  break_minutes: number
  start_time: string | null
  end_time: string | null
  sick_day: boolean | null
}

interface WorkTimePunchRow {
  id: string
  punched_at: string
  kind: 'in' | 'out'
  source: string
}

interface WorkTimeAuditRow {
  id: string
  entry_date: string
  field: string
  old_value: string | null
  new_value: string | null
  reason: string | null
  changed_at: string
}

interface WorkTimeState {
  settings: WorkTimeSettings
  entries: Record<string, WorkDayEntry>
  punches: WorkTimePunch[]
  auditLog: WorkTimeAuditEntry[]
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
  subscribeToWorkTime: () => () => void
}

function ensureEntry(
  entries: Record<string, WorkDayEntry>,
  date: string,
  defaultBreakMinutes: number
): WorkDayEntry {
  return entries[date] ?? { date, workedMinutes: 0, breakMinutes: defaultBreakMinutes }
}

function makeAudit(
  date: string,
  field: string,
  oldValue: string | number | null | undefined,
  newValue: string | number | null | undefined
): WorkTimeAuditEntry {
  return {
    id: createId(),
    entryDate: date,
    field,
    oldValue: oldValue == null ? null : String(oldValue),
    newValue: newValue == null ? null : String(newValue),
    reason: null,
    changedAt: new Date().toISOString(),
  }
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
  activeProfileId?: string,
  manualCompDays?: number,
  takenCompDays?: number
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
    manual_comp_days: manualCompDays,
    taken_comp_days: takenCompDays,
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

// Append-only: record an immutable punch event ("Stempel"). Never updated/deleted.
async function syncPunch(punch: WorkTimePunch) {
  if (!isSupabaseConfigured) return
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await supabase.from('work_time_punches').insert({
    id: punch.id,
    user_id: userId,
    punched_at: punch.punchedAt,
    kind: punch.kind,
    source: punch.source,
  })
}

// Append-only: record a manual correction in the audit trail (Manipulationssicherheit).
async function syncAudit(entry: WorkTimeAuditEntry) {
  if (!isSupabaseConfigured) return
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await supabase.from('work_time_audit').insert({
    id: entry.id,
    user_id: userId,
    entry_date: entry.entryDate,
    field: entry.field,
    old_value: entry.oldValue,
    new_value: entry.newValue,
    reason: entry.reason,
    changed_at: entry.changedAt,
  })
}

export const useWorkTimeStore = create<WorkTimeState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      entries: {},
      punches: [],
      auditLog: [],
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

        const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString()
        const [entriesResult, settingsResult, punchesResult, auditResult] = await Promise.all([
          supabase
            .from('work_time_entries')
            .select('date, worked_minutes, break_minutes, start_time, end_time')
            .eq('user_id', userId),
          supabase.from('work_time_settings').select('*').eq('user_id', userId).maybeSingle(),
          supabase
            .from('work_time_punches')
            .select('id, punched_at, kind, source')
            .eq('user_id', userId)
            .gte('punched_at', since)
            .order('punched_at', { ascending: true }),
          supabase
            .from('work_time_audit')
            .select('id, entry_date, field, old_value, new_value, reason, changed_at')
            .eq('user_id', userId)
            .order('changed_at', { ascending: false }),
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

        const punches: WorkTimePunch[] = ((punchesResult.data ?? []) as WorkTimePunchRow[]).map((p) => ({
          id: p.id,
          punchedAt: p.punched_at,
          kind: p.kind,
          source: p.source,
        }))
        const auditLog: WorkTimeAuditEntry[] = ((auditResult.data ?? []) as WorkTimeAuditRow[]).map((a) => ({
          id: a.id,
          entryDate: a.entry_date,
          field: a.field,
          oldValue: a.old_value,
          newValue: a.new_value,
          reason: a.reason,
          changedAt: a.changed_at,
        }))

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

        const manualCompDays = settingsRow?.manual_comp_days ?? get().manualCompDays
        const takenCompDays = settingsRow?.taken_comp_days ?? get().takenCompDays

        set({
          entries,
          punches,
          auditLog,
          settings,
          settledWeekendDays,
          isRunning: Boolean(runningStartedAt && runningDate),
          runningStartedAt,
          runningDate,
          workProfiles,
          activeProfileId,
          manualCompDays,
          takenCompDays,
        })

        if (!settingsRow) {
          await syncSettings(settings, settledWeekendDays, get().workProfiles, get().activeProfileId, manualCompDays, takenCompDays)
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
        const punch: WorkTimePunch = { id: createId(), punchedAt: runningStartedAt, kind: 'in', source: 'app' }
        set({
          isRunning: true,
          runningStartedAt,
          runningDate,
          entries: { ...state.entries, [runningDate]: updated },
          punches: [...state.punches, punch],
        })
        void syncEntry(updated)
        void syncRunningState(runningStartedAt, runningDate)
        void syncPunch(punch)
      },

      clockOut: () => {
        const state = get()
        if (!state.isRunning || !state.runningStartedAt || !state.runningDate) return
        const punchedAt = new Date().toISOString()
        const elapsedMinutes = Math.round((Date.now() - new Date(state.runningStartedAt).getTime()) / 60000)
        const date = state.runningDate
        const endTime = new Date().toTimeString().slice(0, 5)
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const updated = {
          ...entry,
          workedMinutes: entry.workedMinutes + Math.max(0, elapsedMinutes),
          endTime,
        }
        const punch: WorkTimePunch = { id: createId(), punchedAt, kind: 'out', source: 'app' }
        set({
          entries: { ...state.entries, [date]: updated },
          isRunning: false,
          runningStartedAt: undefined,
          runningDate: undefined,
          punches: [...state.punches, punch],
        })
        void syncEntry(updated)
        void syncRunningState()
        void syncPunch(punch)
      },

      setWorkedMinutes: (date, minutes) => {
        const state = get()
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const updated = { ...entry, workedMinutes: Math.max(0, minutes) }
        const audit = makeAudit(date, 'workedMinutes', entry.workedMinutes, updated.workedMinutes)
        set({ entries: { ...state.entries, [date]: updated }, auditLog: [audit, ...state.auditLog] })
        void syncEntry(updated)
        void syncAudit(audit)
      },

      setBreakMinutes: (date, minutes) => {
        const state = get()
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const updated = { ...entry, breakMinutes: Math.max(0, minutes) }
        const audit = makeAudit(date, 'breakMinutes', entry.breakMinutes, updated.breakMinutes)
        set({ entries: { ...state.entries, [date]: updated }, auditLog: [audit, ...state.auditLog] })
        void syncEntry(updated)
        void syncAudit(audit)
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
        const audit = makeAudit(
          date,
          'dayTimes',
          `${entry.startTime ?? '—'}–${entry.endTime ?? '—'}`,
          `${startTime || '—'}–${endTime || '—'}`
        )
        set({ entries: { ...state.entries, [date]: updated }, auditLog: [audit, ...state.auditLog] })
        void syncEntry(updated)
        void syncAudit(audit)
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
        const audit = makeAudit(date, 'sickDay', 'nein', 'ja')
        set({ entries: { ...state.entries, [date]: updated }, auditLog: [audit, ...state.auditLog] })
        void syncEntry(updated)
        void syncAudit(audit)
      },
      unmarkSickDay: (date) => {
        const state = get()
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const updated = { ...entry, sickDay: false, workedMinutes: 0 }
        const audit = makeAudit(date, 'sickDay', 'ja', 'nein')
        set({ entries: { ...state.entries, [date]: updated }, auditLog: [audit, ...state.auditLog] })
        void syncEntry(updated)
        void syncAudit(audit)
      },
      incrementManualCompDays: () => {
        const manualCompDays = get().manualCompDays + 1
        set({ manualCompDays })
        const s = get()
        void syncSettings(s.settings, s.settledWeekendDays, s.workProfiles, s.activeProfileId, manualCompDays, s.takenCompDays)
      },
      takeCompDay: () => {
        const takenCompDays = get().takenCompDays + 1
        set({ takenCompDays })
        const s = get()
        void syncSettings(s.settings, s.settledWeekendDays, s.workProfiles, s.activeProfileId, s.manualCompDays, takenCompDays)
      },
      incrementCompensationDays: () => set((s) => ({ compensationDaysCount: s.compensationDaysCount + 1 })),
      decrementCompensationDays: () => set((s) => ({ compensationDaysCount: Math.max(0, s.compensationDaysCount - 1) })),

      subscribeToWorkTime: () => {
        if (!isSupabaseConfigured) return () => {}
        const channel = supabase
          .channel('worktime-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'work_time_settings' }, () => get().fetchAll())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'work_time_entries' }, () => get().fetchAll())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'work_time_punches' }, () => get().fetchAll())
          .on('postgres_changes', { event: '*', schema: 'public', table: 'work_time_audit' }, () => get().fetchAll())
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      },
    }),
    { name: 'flowdo-worktime' }
  )
)
