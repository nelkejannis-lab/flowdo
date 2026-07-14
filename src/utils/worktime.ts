import { isWeekend, isFriday, parseISO } from 'date-fns'
import type { WorkDayEntry, WorkTimeSettings, WorkTimePunch } from '../types'

// Contract-based daily average (used for overtime overview vs contract)
export function dailyTargetMinutes(settings: WorkTimeSettings): number {
  return (settings.weeklyHours * 60) / settings.workDaysPerWeek
}

// Mon-Thu schedule target (for table display)
export function weekdayTargetMinutes(settings: WorkTimeSettings): number {
  if (settings.weekdayHours != null) return settings.weekdayHours * 60
  return dailyTargetMinutes(settings)
}

// Friday schedule target (for table display)
export function fridayTargetMinutes(settings: WorkTimeSettings): number {
  if (settings.fridayHours != null) return settings.fridayHours * 60
  return weekdayTargetMinutes(settings)
}

// Per-day schedule target (table "Soll" column)
export function dayTargetMinutes(date: Date, settings: WorkTimeSettings): number {
  if (isWeekend(date)) return 0
  if (isFriday(date)) return fridayTargetMinutes(settings)
  return weekdayTargetMinutes(settings)
}

export function netMinutes(entry?: WorkDayEntry): number {
  if (!entry) return 0
  return Math.max(0, entry.workedMinutes - entry.breakMinutes)
}

export function formatHM(minutes: number): string {
  const sign = minutes < 0 ? '-' : ''
  const abs = Math.round(Math.abs(minutes))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}:${String(m).padStart(2, '0')} h`
}

/** Format net minutes as H:MM for worked-hours input fields. */
export function formatWorkedHoursInput(netMinutes: number): string {
  const abs = Math.max(0, Math.round(netMinutes))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

/** Parse user input as net worked time: 8 → 8h, 8.5 → 8:30, 8:30 → 8:30. */
export function parseWorkedHoursInput(text: string): number | null {
  const s = text.trim()
  if (!s) return null

  const colonMatch = s.match(/^(\d{1,2}):(\d{1,2})$/)
  if (colonMatch) {
    const h = parseInt(colonMatch[1], 10)
    const m = parseInt(colonMatch[2], 10)
    if (m >= 60 || Number.isNaN(h) || Number.isNaN(m)) return null
    return h * 60 + m
  }

  const normalized = s.replace(',', '.')
  if (/^\d+(\.\d+)?$/.test(normalized)) {
    const val = parseFloat(normalized)
    if (Number.isNaN(val) || val < 0) return null
    return Math.round(val * 60)
  }

  return null
}

export function formatHoursDecimal(minutes: number, digits = 1): string {
  const sign = minutes < 0 ? '-' : ''
  return `${sign}${(Math.abs(minutes) / 60).toFixed(digits)}`
}

export function minutesToHoursValue(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100
}

export function hoursValueToMinutes(hours: number): number {
  return Math.round(hours * 60)
}

export function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

// Dauer zwischen zwei Uhrzeiten in Minuten, über Mitternacht hinweg möglich.
export function durationBetween(startTime: string, endTime: string): number | null {
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)
  if (start === null || end === null) return null
  const diff = end - start
  return diff >= 0 ? diff : diff + 24 * 60
}

// Ab dieser Arbeitszeit an einem Wochenendtag gibt es einen vollen Ausgleichstag.
export const WEEKEND_COMP_DAY_THRESHOLD_MINUTES = 6 * 60 // 6h minimum to earn a comp day

export function weekendCompThreshold(settings: WorkTimeSettings): number {
  // Use Friday hours as threshold if set, otherwise fall back to daily target
  return fridayTargetMinutes(settings)
}

// ── German Arbeitszeitgesetz (ArbZG) compliance ───────────────────────────────
// §3: max 8h/day (extendable to 10h with compensation). §4: breaks. §5: 11h rest.
export const ARBZG_MAX_DAILY_MINUTES = 10 * 60       // §3 absolute daily cap
export const ARBZG_REST_MINUTES = 11 * 60            // §5 minimum rest between shifts
export const ARBZG_BREAK_THRESHOLD_1 = 6 * 60        // >6h worked → ≥30 min break
export const ARBZG_BREAK_MINUTES_1 = 30
export const ARBZG_BREAK_THRESHOLD_2 = 9 * 60        // >9h worked → ≥45 min break
export const ARBZG_BREAK_MINUTES_2 = 45

export interface ArbZgWarning {
  code: 'maxDaily' | 'break' | 'rest'
  severity: 'warn' | 'error'
}

// Returns ArbZG violations for a single day. `prevDayEntry` is the previous day for rest-period check.
export function arbzgWarnings(
  entry: WorkDayEntry | undefined,
  prevDayLastOut?: string,
  firstInToday?: string
): ArbZgWarning[] {
  const warnings: ArbZgWarning[] = []
  if (!entry) return warnings
  const net = netMinutes(entry)

  // §3 Höchstarbeitszeit
  if (net > ARBZG_MAX_DAILY_MINUTES) {
    warnings.push({ code: 'maxDaily', severity: 'error' })
  }

  // §4 Pausen (based on gross worked time)
  const gross = entry.workedMinutes
  if (gross > ARBZG_BREAK_THRESHOLD_2 && entry.breakMinutes < ARBZG_BREAK_MINUTES_2) {
    warnings.push({ code: 'break', severity: 'warn' })
  } else if (gross > ARBZG_BREAK_THRESHOLD_1 && entry.breakMinutes < ARBZG_BREAK_MINUTES_1) {
    warnings.push({ code: 'break', severity: 'warn' })
  }

  // §5 Ruhezeit (11h between yesterday's last out and today's first in)
  if (prevDayLastOut && firstInToday) {
    const last = new Date(prevDayLastOut).getTime()
    const first = new Date(firstInToday).getTime()
    if (first > last) {
      const restMinutes = (first - last) / 60000
      if (restMinutes < ARBZG_REST_MINUTES) {
        warnings.push({ code: 'rest', severity: 'warn' })
      }
    }
  }

  return warnings
}

// Group punches by local calendar day (yyyy-MM-dd) for stamp-log display.
export function punchesForDay(punches: WorkTimePunch[], isoDate: string): WorkTimePunch[] {
  return punches
    .filter((p) => toLocalDate(p.punchedAt) === isoDate)
    .sort((a, b) => a.punchedAt.localeCompare(b.punchedAt))
}

function toLocalDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatPunchTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export interface OvertimeOverview {
  totalDiffMinutes: number
  totalDiffDays: number
  weekendDaysWorked: number
}

export function computeOverview(
  entries: Record<string, WorkDayEntry>,
  settings: WorkTimeSettings
): OvertimeOverview {
  let totalDiffMinutes = 0
  let weekendDaysWorked = 0

  for (const entry of Object.values(entries)) {
    const date = parseISO(entry.date)
    const target = dayTargetMinutes(date, settings)
    const net = netMinutes(entry)

    if (isWeekend(date)) {
      const threshold = weekendCompThreshold(settings)
      if (net >= threshold) {
        weekendDaysWorked++
        // only hours above the full-day threshold count as overtime
        totalDiffMinutes += Math.max(0, net - threshold)
      }
      // below threshold: weekend hours neither overtime nor comp day
    } else {
      totalDiffMinutes += net - target
    }
  }

  const dailyTarget = dailyTargetMinutes(settings)

  return {
    totalDiffMinutes,
    totalDiffDays: dailyTarget > 0 ? totalDiffMinutes / dailyTarget : 0,
    weekendDaysWorked,
  }
}
