import { isWeekend, parseISO } from 'date-fns'
import type { WorkDayEntry, WorkTimeSettings } from '../types'

export function dailyTargetMinutes(settings: WorkTimeSettings): number {
  return (settings.weeklyHours * 60) / settings.workDaysPerWeek
}

export function dayTargetMinutes(date: Date, settings: WorkTimeSettings): number {
  return isWeekend(date) ? 0 : dailyTargetMinutes(settings)
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

// Ab dieser Arbeitszeit an einem Wochenendtag gibt es einen vollen Ausgleichstag,
// alles darüber zählt zusätzlich als Überstunden (7 Stunden 42 Minuten).
export const WEEKEND_COMP_DAY_THRESHOLD_MINUTES = 7 * 60 + 42

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
      if (net >= WEEKEND_COMP_DAY_THRESHOLD_MINUTES) {
        weekendDaysWorked++
        // only hours above daily target count as overtime
        const dailyTgt = dailyTargetMinutes(settings)
        totalDiffMinutes += Math.max(0, net - dailyTgt)
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
