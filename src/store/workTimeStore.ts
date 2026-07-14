import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WorkDayEntry, WorkProfile, WorkTimeSettings, WorkTimePunch, WorkTimeAuditEntry, AbsencePeriod, AbsenceType } from '../types'
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
  isOnBreak: boolean
  breakStartedAt?: string
  breakType?: string
  settledWeekendDays: number
  manualCompDays: number
  takenCompDays: number
  compensationDaysCount: number
  workProfiles: WorkProfile[]
  activeProfileId?: string
  absencePeriods: AbsencePeriod[]
  teamAbsences: AbsencePeriod[]
  fetchAll: () => Promise<void>
  fetchTeamAbsences: () => Promise<void>
  reviewAbsence: (id: string, approved: boolean) => Promise<string | null>
  clockIn: () => void
  clockOut: () => void
  startBreak: (type: string) => void
  endBreak: () => void
  setWorkedMinutes: (date: string, minutes: number) => void
  setBreakMinutes: (date: string, minutes: number) => void
  setDayTimes: (date: string, startTime: string, endTime: string) => void
  updateSettings: (updates: Partial<WorkTimeSettings>) => void
  addWorkProfile: (profile: Omit<WorkProfile, 'id'>) => void
  deleteWorkProfile: (id: string) => void
  applyWorkProfile: (id: string) => void
  markSickDay: (date: string) => void
  unmarkSickDay: (date: string) => void
  addAbsencePeriod: (startDate: string, endDate: string, type: AbsenceType, note?: string) => void
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
  _defaultBreakMinutes: number
): WorkDayEntry {
  return entries[date] ?? { date, workedMinutes: 0, breakMinutes: 0 }
}

function eachDateInRange(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

function applyAbsenceToEntries(
  entries: Record<string, WorkDayEntry>,
  period: AbsencePeriod,
  settings: WorkTimeSettings,
  sync = true,
) {
  const dates = eachDateInRange(period.startDate, period.endDate)
  for (const date of dates) {
    if (period.type === 'sick') {
      const entry = ensureEntry(entries, date, settings.defaultBreakMinutes)
      const target = dayTargetForDate(date, settings)
      entries[date] = { ...entry, sickDay: true, workedMinutes: target, breakMinutes: 0, startTime: undefined, endTime: undefined }
      if (sync) void syncEntry(entries[date])
    } else if (period.type === 'vacation') {
      const entry = ensureEntry(entries, date, settings.defaultBreakMinutes)
      const target = dayTargetForDate(date, settings)
      entries[date] = { ...entry, workedMinutes: target, breakMinutes: 0 }
      if (sync) void syncEntry(entries[date])
    }
  }
}

function dayTargetForDate(date: string, settings: WorkTimeSettings): number {
  const d = new Date(date + 'T12:00:00')
  const dow = d.getDay()
  if (dow === 0 || dow === 6) return 0
  if (dow === 5) return Math.round((settings.fridayHours ?? settings.weeklyHours / settings.workDaysPerWeek) * 60)
  return Math.round((settings.weekdayHours ?? settings.weeklyHours / settings.workDaysPerWeek) * 60)
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

async function syncEntryForUser(userId: string, entry: WorkDayEntry) {
  if (!isSupabaseConfigured) return
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

async function applyApprovedAbsenceForUser(period: AbsencePeriod, targetUserId: string) {
  const { data: settingsRow } = await supabase
    .from('work_time_settings')
    .select('weekly_hours, work_days_per_week, default_break_minutes, friday_hours, weekday_hours')
    .eq('user_id', targetUserId)
    .maybeSingle()
  const settings: WorkTimeSettings = settingsRow
    ? {
        weeklyHours: Number(settingsRow.weekly_hours),
        workDaysPerWeek: settingsRow.work_days_per_week,
        defaultBreakMinutes: settingsRow.default_break_minutes,
        fridayHours: settingsRow.friday_hours ?? undefined,
        weekdayHours: settingsRow.weekday_hours ?? undefined,
      }
    : defaultSettings
  const entries: Record<string, WorkDayEntry> = {}
  applyAbsenceToEntries(entries, period, settings, false)
  for (const entry of Object.values(entries)) {
    await syncEntryForUser(targetUserId, entry)
  }
}

async function syncEntry(entry: WorkDayEntry) {
  if (!isSupabaseConfigured) return
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return
  await syncEntryForUser(userId, entry)
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
      isOnBreak: false,
      breakStartedAt: undefined,
      breakType: undefined,
      settledWeekendDays: 0,
      manualCompDays: 0,
      takenCompDays: 0,
      compensationDaysCount: 0,
      workProfiles: [GBM_PROFILE],
      activeProfileId: undefined,
      absencePeriods: [],
      teamAbsences: [],

      fetchAll: async () => {
        if (!isSupabaseConfigured) return
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (!userId) return

        const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 120).toISOString()
        const [entriesResult, settingsResult, punchesResult, auditResult, absenceResult] = await Promise.all([
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
          supabase
            .from('absence_periods')
            .select('id, type, start_date, end_date, note, status, reviewed_by, reviewed_at')
            .eq('user_id', userId)
            .order('start_date', { ascending: false }),
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

        const absencePeriods: AbsencePeriod[] = ((absenceResult.data ?? []) as {
          id: string; type: AbsenceType; start_date: string; end_date: string; note: string | null
          status?: string; reviewed_by?: string | null; reviewed_at?: string | null
        }[]).map((a) => ({
          id: a.id,
          type: a.type,
          startDate: a.start_date,
          endDate: a.end_date,
          note: a.note ?? undefined,
          status: (a.status as AbsencePeriod['status']) ?? 'approved',
          reviewedBy: a.reviewed_by ?? undefined,
          reviewedAt: a.reviewed_at ?? undefined,
        }))

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
          absencePeriods,
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

      // Start a break (rauchen, trinken, …). Work time freezes in the UI; the actual
      // break minutes are added to the day on endBreak so net work excludes the break.
      startBreak: (type) => {
        const s = get()
        if (!s.isRunning || s.isOnBreak) return
        set({ isOnBreak: true, breakStartedAt: new Date().toISOString(), breakType: type })
      },

      endBreak: () => {
        const state = get()
        if (!state.isOnBreak || !state.breakStartedAt) return
        const now = new Date()
        const startedAt = state.breakStartedAt
        const durationMin = Math.max(0, Math.round((now.getTime() - new Date(startedAt).getTime()) / 60000))
        const date = state.runningDate ?? todayISO()
        const entry = ensureEntry(state.entries, date, state.settings.defaultBreakMinutes)
        const updated = { ...entry, breakMinutes: entry.breakMinutes + durationMin }
        // Record the break as a Gehen/Kommen pair in the tamper-proof punch log
        const outPunch: WorkTimePunch = { id: createId(), punchedAt: startedAt, kind: 'out', source: 'break' }
        const inPunch: WorkTimePunch = { id: createId(), punchedAt: now.toISOString(), kind: 'in', source: 'break' }
        set({
          entries: { ...state.entries, [date]: updated },
          punches: [...state.punches, outPunch, inPunch],
          isOnBreak: false,
          breakStartedAt: undefined,
          breakType: undefined,
        })
        void syncEntry(updated)
        void syncPunch(outPunch)
        void syncPunch(inPunch)
      },

      clockOut: () => {
        // Finish any running break first so its minutes are counted.
        if (get().isOnBreak) get().endBreak()
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
        // Direct hours entry: pause is tracked separately; clear Von/Bis so netMinutes won't deduct break.
        const updated = {
          ...entry,
          workedMinutes: Math.max(0, minutes),
          startTime: undefined,
          endTime: undefined,
        }
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
      addAbsencePeriod: (startDate, endDate, type, note) => {
        const state = get()
        const needsApproval = type === 'vacation' || type === 'overtime'
        const status = needsApproval ? 'pending' : 'approved'
        const period: AbsencePeriod = { id: createId(), type, startDate, endDate, note, status }
        const newEntries = { ...state.entries }
        if (status === 'approved') {
          applyAbsenceToEntries(newEntries, period, state.settings)
        }
        set({ entries: newEntries, absencePeriods: [period, ...state.absencePeriods] })
        if (isSupabaseConfigured) {
          void supabase.auth.getUser().then(({ data }) => {
            const userId = data.user?.id
            if (!userId) return
            void supabase.from('absence_periods').insert({
              id: period.id,
              user_id: userId,
              type: period.type,
              start_date: period.startDate,
              end_date: period.endDate,
              note: period.note ?? null,
              status,
            })
          })
        }
      },
      fetchTeamAbsences: async () => {
        if (!isSupabaseConfigured) return
        const { useOrganizationStore } = await import('./organizationStore')
        if (!useOrganizationStore.getState().canApproveAbsences()) return
        const memberIds = useOrganizationStore.getState().members.map((m) => m.userId)
        if (memberIds.length === 0) return
        const { data } = await supabase
          .from('absence_periods')
          .select('id, user_id, type, start_date, end_date, note, status, reviewed_by, reviewed_at, profile:profiles!absence_periods_user_id_fkey(display_name, username)')
          .in('user_id', memberIds)
          .order('start_date', { ascending: false })
          .limit(50)
        const teamAbsences: AbsencePeriod[] = (data ?? []).map((a: any) => ({
          id: a.id,
          userId: a.user_id,
          type: a.type,
          startDate: a.start_date,
          endDate: a.end_date,
          note: a.note ?? undefined,
          status: a.status ?? 'approved',
          reviewedBy: a.reviewed_by ?? undefined,
          reviewedAt: a.reviewed_at ?? undefined,
          profile: Array.isArray(a.profile) ? a.profile[0] : a.profile,
        }))
        set({ teamAbsences })
      },
      reviewAbsence: async (id, approved) => {
        const status = approved ? 'approved' : 'rejected'
        const { data: userData } = await supabase.auth.getUser()
        const reviewerId = userData.user?.id
        if (!reviewerId) return 'Not signed in'

        const period = get().teamAbsences.find((a) => a.id === id) ?? get().absencePeriods.find((a) => a.id === id)
        if (!period) return 'Not found'

        const { error } = await supabase
          .from('absence_periods')
          .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString() })
          .eq('id', id)
        if (error) return error.message

        if (approved && period.userId) {
          await applyApprovedAbsenceForUser({ ...period, status: 'approved' }, period.userId)
        } else if (approved && !period.userId) {
          const state = get()
          const newEntries = { ...state.entries }
          applyAbsenceToEntries(newEntries, { ...period, status: 'approved' }, state.settings)
          set({ entries: newEntries })
        }

        const updateList = (list: AbsencePeriod[]) =>
          list.map((a) => (a.id === id ? { ...a, status: status as AbsencePeriod['status'], reviewedBy: reviewerId, reviewedAt: new Date().toISOString() } : a))
        set({
          teamAbsences: updateList(get().teamAbsences),
          absencePeriods: updateList(get().absencePeriods),
        })
        return null
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
