import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import type { CalendarEntry, EisenhowerQuadrant, Task, WorkDayEntry, WorkTimeSettings } from '../types'
import type { TaskTimeEntry } from '../store/taskTimeStore'
import { computeFocusStreak, type ReadinessTask } from './dayReadiness'
import { dayTargetMinutes, netMinutes } from '../utils/worktime'

export type StatisticsPeriod = 'today' | 'week' | 'month'

export interface PeriodRange {
  startISO: string // yyyy-MM-dd
  endISO: string // yyyy-MM-dd
  dayISOs: string[] // inclusive
}

function toISODate(isoOrTimestamp?: string): string | undefined {
  if (!isoOrTimestamp) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrTimestamp)) return isoOrTimestamp
  try {
    const d = parseISO(isoOrTimestamp)
    if (Number.isNaN(d.getTime())) return undefined
    return format(d, 'yyyy-MM-dd')
  } catch {
    return undefined
  }
}

function inRangeISO(dayISO: string, startISO: string, endISO: string): boolean {
  return dayISO >= startISO && dayISO <= endISO
}

/** Inclusive range for Today/Woche/Monat plus the concrete list of days. */
export function getPeriodRange(period: StatisticsPeriod, now = new Date()): PeriodRange {
  const start =
    period === 'today'
      ? startOfDay(now)
      : period === 'week'
        ? startOfWeek(now, { weekStartsOn: 1 })
        : startOfMonth(now)

  const end =
    period === 'today'
      ? start
      : period === 'week'
        ? endOfWeek(now, { weekStartsOn: 1 })
        : endOfMonth(now)

  const startISO = format(start, 'yyyy-MM-dd')
  const endISO = format(end, 'yyyy-MM-dd')

  const dayISOs: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) {
    dayISOs.push(format(d, 'yyyy-MM-dd'))
  }

  return { startISO, endISO, dayISOs }
}

export interface TaskPeriodStats {
  total: number
  open: number
  completedInPeriod: number
  completedFocusInPeriod: number
  overdueOpen: number
  dueInPeriodOpen: number
  focusStreak: number
}

function isFocusTask(t: Pick<Task, 'urgent' | 'important' | 'priority'>): boolean {
  return t.urgent || t.important || t.priority === 'high'
}

/** Company KPI aggregations for a given date range. */
export function computeTaskStats(tasks: Task[], startISO: string, endISO: string, todayISO: string): TaskPeriodStats {
  const open = tasks.filter((t) => !t.completed)
  const completed = tasks.filter((t) => t.completed)

  const completedISO = completed
    .map((t) => toISODate(t.completedAt))
    .filter((d): d is string => Boolean(d))

  const completedInPeriod = completedISO.filter((d) => inRangeISO(d, startISO, endISO)).length
  const completedFocusInPeriod = completed.filter((t) => {
    if (!t.completed) return false
    const d = toISODate(t.completedAt)
    return d ? inRangeISO(d, startISO, endISO) && isFocusTask(t) : false
  }).length

  const overdueOpen = open.filter((t) => {
    const due = t.dueDate
    if (!due) return false
    return due < todayISO
  }).length

  const dueInPeriodOpen = open.filter((t) => t.dueDate && inRangeISO(t.dueDate, startISO, endISO)).length

  const readinessTasks: ReadinessTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    completed: t.completed,
    completedAt: t.completedAt,
    dueDate: t.dueDate,
    urgent: t.urgent,
    important: t.important,
    priority: t.priority,
  }))

  const focusStreak = computeFocusStreak(readinessTasks)

  return {
    total: tasks.length,
    open: open.length,
    completedInPeriod,
    completedFocusInPeriod,
    overdueOpen,
    dueInPeriodOpen,
    focusStreak,
  }
}

const QUADRANT_COLORS: Record<EisenhowerQuadrant, string> = {
  do: 'rgb(239 68 68)', // red-500
  decide: 'rgb(245 158 11)', // amber-500
  delegate: 'rgb(59 130 246)', // blue-500
  delete: 'rgb(16 185 129)', // emerald-500
}

export function eisenhowerDistribution(tasks: Task[]): { value: number; color: string; quadrant: EisenhowerQuadrant }[] {
  const counts: Record<EisenhowerQuadrant, number> = { do: 0, decide: 0, delegate: 0, delete: 0 }

  for (const t of tasks) {
    // If it was explicitly "not placed", treat it as "delete"/unconfigured.
    const placed = t.matrixPlaced !== false
    let quadrant: EisenhowerQuadrant
    if (!placed) quadrant = 'delete'
    else if (t.urgent && t.important) quadrant = 'do'
    else if (!t.urgent && t.important) quadrant = 'decide'
    else if (t.urgent && !t.important) quadrant = 'delegate'
    else quadrant = 'delete'

    counts[quadrant]++
  }

  return (['do', 'decide', 'delegate', 'delete'] as EisenhowerQuadrant[]).map((q) => ({
    quadrant: q,
    value: counts[q],
    color: QUADRANT_COLORS[q],
  }))
}

function parseTimeToMinutes(time?: string): number | null {
  if (!time) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

function durationMinutes(startTime?: string, endTime?: string): number {
  const s = parseTimeToMinutes(startTime)
  const e = parseTimeToMinutes(endTime)
  if (s == null || e == null) return 30
  const diff = e - s
  return diff >= 0 ? diff : diff + 24 * 60
}

/** Minutes per day from calendar entries (defaults to meetings = `type === 'termin'`). */
export function calendarMinutesByDay(
  entries: CalendarEntry[],
  dayISOs: string[],
  opts?: { includeTypes?: CalendarEntry['type'][] },
): number[] {
  const includeTypes = opts?.includeTypes ?? ['termin']
  const filtered = entries.filter((e) => includeTypes.includes(e.type))

  const daySet = new Set(dayISOs)

  const minutes = dayISOs.map((dayISO) => {
    let sum = 0
    for (const e of filtered) {
      const start = e.date
      const end = e.endDate ?? e.date
      if (dayISO < start || dayISO > end) continue
      // Use explicit times only on the start day; multi-day events get a flat estimate.
      sum += dayISO === start ? durationMinutes(e.startTime, e.endTime) : 30
    }
    return sum
  })

  // Ensure deterministic length even if caller passed empty `dayISOs`.
  return daySet.size === 0 ? dayISOs.map(() => 0) : minutes
}

export function workMinutesByDay(
  entries: Record<string, WorkDayEntry | undefined>,
  settings: WorkTimeSettings,
  dayISOs: string[],
): { actual: number[]; target: number[] } {
  const actual = dayISOs.map((iso) => {
    const entry = entries[iso]
    return netMinutes(entry)
  })

  const target = dayISOs.map((iso) => {
    const d = parseISO(iso)
    return dayTargetMinutes(d, settings)
  })

  return { actual, target }
}

/** Task time logged per day (from `task_time_entries`, summed across tasks). */
export function taskTimeMinutesByDay(entries: TaskTimeEntry[], dayISOs: string[]): number[] {
  const daySet = new Set(dayISOs)
  const byDay: Record<string, number> = {}
  for (const e of entries) {
    if (!daySet.has(e.date)) continue
    byDay[e.date] = (byDay[e.date] ?? 0) + e.minutes
  }
  return dayISOs.map((iso) => byDay[iso] ?? 0)
}

/** Normalizes values for Sparkline rendering. */
export function sparklines(values: number[]): number[] {
  return values.map((v) => (Number.isFinite(v) && v >= 0 ? v : 0))
}

