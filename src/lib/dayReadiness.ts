import { format, parseISO, subDays } from 'date-fns'
import { isCompletedToday, isDueToday, isOverdue, todayISO } from '../utils/date'

/** Minimal task shape needed for Day Readiness / weekly insights. */
export interface ReadinessTask {
  id: string
  title: string
  completed: boolean
  completedAt?: string
  dueDate?: string
  urgent: boolean
  important: boolean
  priority: string
}

export type ReadinessBand = 'sharp' | 'ready' | 'stretched' | 'critical'

export interface NextAction {
  id: string
  kind: 'priority' | 'overdue' | 'event' | 'plan' | 'status' | 'celebrate'
  title: string
  /** i18n key under readiness.next.* or raw title for task names */
  labelKey?: string
  taskId?: string
}

export interface DayReadinessInput {
  tasks: ReadinessTask[]
  capacityPercent: number
  meetingMinutes: number
  targetMinutes: number
  hasWorkStatus: boolean
  isWorkRunning: boolean
  openTodayCount: number
  nextEventTitle?: string | null
}

export interface DayReadinessResult {
  score: number
  band: ReadinessBand
  /** Primary "why" explanation key under readiness.why.* */
  whyKey: string
  whyParams?: Record<string, string | number>
  /** Secondary factors for the Warum panel */
  factorKeys: string[]
  nextActions: NextAction[]
  streak: number
  completedFocusToday: number
  openQ1: number
  overdueCount: number
  todayDone: boolean
}

export interface WeeklyInsight {
  completedCount: number
  completedFocusCount: number
  openRemaining: number
  overdueCount: number
  peakDayKey: string | null
  peakLoad: number
  winTitles: string[]
  /** Heuristic recap keys under readiness.week.* */
  headlineKey: string
  bodyKey: string
  bodyParams?: Record<string, string | number>
  progressPercent: number
}

function isFocusTask(t: ReadinessTask): boolean {
  return t.urgent || t.important || t.priority === 'high'
}

function completedOnDay(t: ReadinessTask, iso: string): boolean {
  if (!t.completed || !t.completedAt) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(t.completedAt)) return t.completedAt === iso
  try {
    return format(parseISO(t.completedAt), 'yyyy-MM-dd') === iso
  } catch {
    return false
  }
}

/** Consecutive days (ending today or yesterday) with ≥1 completed focus task. */
export function computeFocusStreak(tasks: ReadinessTask[]): number {
  let streak = 0
  const today = new Date()
  // Allow streak to continue if today has no completion yet but yesterday did
  let started = false
  for (let i = 0; i < 60; i++) {
    const d = subDays(today, i)
    const iso = format(d, 'yyyy-MM-dd')
    const hit = tasks.some((t) => completedOnDay(t, iso) && isFocusTask(t))
    if (hit) {
      streak++
      started = true
    } else if (i === 0 && !started) {
      // Today empty — keep looking at yesterday without breaking
      continue
    } else {
      break
    }
  }
  return streak
}

/**
 * Tages-Bereitschaft (Day Readiness) — NOVAT proprietary 0–100 score.
 *
 * Weights:
 * - Capacity balance (30): sweet spot ~35–70% load; overload & idle both hurt
 * - Priority control (25): fewer open Q1 (urgent+important) is better; clearing Q1 today helps
 * - Urgency pressure (25): overdue + open urgent due today pull the score down
 * - Work posture (10): location set or timer running
 * - Focus streak (10): days with completed focus tasks
 */
export function computeDayReadiness(input: DayReadinessInput): DayReadinessResult {
  const {
    tasks,
    capacityPercent,
    meetingMinutes,
    targetMinutes,
    hasWorkStatus,
    isWorkRunning,
    openTodayCount,
    nextEventTitle,
  } = input

  const open = tasks.filter((t) => !t.completed)
  const openQ1 = open.filter((t) => t.urgent && t.important)
  const overdueList = open.filter((t) => isOverdue(t.dueDate))
  const urgentToday = open.filter((t) => t.urgent && (isDueToday(t.dueDate) || isOverdue(t.dueDate)))
  const completedFocusToday = tasks.filter((t) => isCompletedToday(t.completedAt) && isFocusTask(t)).length
  const todayDone = openTodayCount === 0 && completedFocusToday > 0
  const streak = computeFocusStreak(tasks)

  // --- Capacity balance (0–30) ---
  const meetingLoad = targetMinutes > 0 ? Math.min(40, (meetingMinutes / targetMinutes) * 100) : 0
  const effectiveLoad = Math.min(120, capacityPercent + meetingLoad * 0.35)
  let capacityPts = 30
  if (effectiveLoad < 20) capacityPts = 12 + (effectiveLoad / 20) * 10
  else if (effectiveLoad <= 70) capacityPts = 30
  else if (effectiveLoad <= 95) capacityPts = 30 - ((effectiveLoad - 70) / 25) * 14
  else capacityPts = Math.max(4, 16 - (effectiveLoad - 95) * 0.4)

  // --- Priority control (0–25) ---
  let priorityPts = Math.max(4, 25 - openQ1.length * 5)
  if (completedFocusToday > 0) priorityPts = Math.min(25, priorityPts + 3)
  if (openQ1.length === 0 && open.length > 0) priorityPts = Math.min(25, priorityPts + 2)

  // --- Urgency pressure (0–25) ---
  const pressure = overdueList.length * 7 + urgentToday.length * 4
  const urgencyPts = Math.max(0, 25 - Math.min(25, pressure))

  // --- Work posture (0–10) ---
  const posturePts = hasWorkStatus || isWorkRunning ? 10 : openTodayCount > 0 ? 3 : 6

  // --- Focus streak (0–10) ---
  let streakPts = 0
  if (streak >= 7) streakPts = 10
  else if (streak >= 3) streakPts = 7
  else if (streak >= 1) streakPts = 4

  const score = Math.round(
    Math.min(100, Math.max(0, capacityPts + priorityPts + urgencyPts + posturePts + streakPts)),
  )

  let band: ReadinessBand = 'ready'
  if (score >= 80) band = 'sharp'
  else if (score >= 60) band = 'ready'
  else if (score >= 40) band = 'stretched'
  else band = 'critical'

  // Why blurb — pick the strongest signal
  let whyKey = 'balanced'
  const whyParams: Record<string, string | number> = {}
  const factorKeys: string[] = []

  if (todayDone) {
    whyKey = 'allClear'
  } else if (overdueList.length > 0) {
    whyKey = 'overdue'
    whyParams.count = overdueList.length
    factorKeys.push('factorOverdue')
  } else if (effectiveLoad >= 90) {
    whyKey = 'overloaded'
    factorKeys.push('factorCapacityHigh')
  } else if (openQ1.length >= 3) {
    whyKey = 'q1Heavy'
    whyParams.count = openQ1.length
    factorKeys.push('factorQ1')
  } else if (!hasWorkStatus && !isWorkRunning && openTodayCount > 0) {
    whyKey = 'noStatus'
    factorKeys.push('factorStatus')
  } else if (effectiveLoad < 25 && openTodayCount === 0) {
    whyKey = 'lightDay'
    factorKeys.push('factorCapacityLow')
  } else if (streak >= 3) {
    whyKey = 'streak'
    whyParams.count = streak
    factorKeys.push('factorStreak')
  } else if (completedFocusToday > 0) {
    whyKey = 'progress'
    whyParams.count = completedFocusToday
  }

  if (openQ1.length > 0 && !factorKeys.includes('factorQ1')) factorKeys.push('factorQ1')
  if (effectiveLoad >= 70 && !factorKeys.includes('factorCapacityHigh')) factorKeys.push('factorCapacityHigh')
  if (streak >= 1 && !factorKeys.includes('factorStreak')) factorKeys.push('factorStreak')

  // Next actions
  const nextActions: NextAction[] = []
  if (todayDone) {
    nextActions.push({ id: 'celebrate', kind: 'celebrate', title: '', labelKey: 'celebrate' })
  } else {
    for (const t of openQ1.slice(0, 2)) {
      nextActions.push({ id: `q1-${t.id}`, kind: 'priority', title: t.title, taskId: t.id })
    }
    for (const t of overdueList.filter((x) => !(x.urgent && x.important)).slice(0, 1)) {
      nextActions.push({ id: `od-${t.id}`, kind: 'overdue', title: t.title, taskId: t.id })
    }
    if (nextEventTitle) {
      nextActions.push({ id: 'event', kind: 'event', title: nextEventTitle, labelKey: 'prepEvent' })
    }
    if (!hasWorkStatus && !isWorkRunning) {
      nextActions.push({ id: 'status', kind: 'status', title: '', labelKey: 'setStatus' })
    }
    if (nextActions.length === 0) {
      nextActions.push({ id: 'plan', kind: 'plan', title: '', labelKey: 'planDay' })
    }
  }

  return {
    score,
    band,
    whyKey,
    whyParams,
    factorKeys: factorKeys.slice(0, 3),
    nextActions: nextActions.slice(0, 3),
    streak,
    completedFocusToday,
    openQ1: openQ1.length,
    overdueCount: overdueList.length,
    todayDone,
  }
}

export function computeWeeklyInsight(
  tasks: ReadinessTask[],
  dayLoads: { iso: string; label: string; total: number }[],
): WeeklyInsight {
  const now = new Date()
  const weekStart = format(
    (() => {
      const d = new Date(now)
      const day = d.getDay()
      const diff = day === 0 ? 6 : day - 1
      d.setDate(d.getDate() - diff)
      d.setHours(0, 0, 0, 0)
      return d
    })(),
    'yyyy-MM-dd',
  )
  const today = todayISO()

  const completedThisWeek = tasks.filter((t) => {
    if (!t.completed || !t.completedAt) return false
    const day = t.completedAt.slice(0, 10)
    return day >= weekStart && day <= today
  })
  const completedFocus = completedThisWeek.filter(isFocusTask)
  const open = tasks.filter((t) => !t.completed)
  const overdue = open.filter((t) => isOverdue(t.dueDate))
  const dueThisWeekOpen = open.filter((t) => t.dueDate && t.dueDate >= weekStart && t.dueDate <= today)

  const peak = [...dayLoads].sort((a, b) => b.total - a.total)[0]
  const winTitles = completedFocus.slice(0, 3).map((t) => t.title)

  const done = completedThisWeek.length
  const remaining = dueThisWeekOpen.length + overdue.length
  const denom = Math.max(1, done + remaining)
  const progressPercent = Math.round((done / denom) * 100)

  let headlineKey = 'steady'
  let bodyKey = 'steadyBody'
  const bodyParams: Record<string, string | number> = {
    done,
    focus: completedFocus.length,
    remaining,
  }

  if (done === 0 && remaining === 0) {
    headlineKey = 'quiet'
    bodyKey = 'quietBody'
  } else if (progressPercent >= 75) {
    headlineKey = 'strong'
    bodyKey = 'strongBody'
  } else if (overdue.length >= 3) {
    headlineKey = 'catchup'
    bodyKey = 'catchupBody'
    bodyParams.overdue = overdue.length
  } else if (peak && peak.total >= 4) {
    headlineKey = 'peak'
    bodyKey = 'peakBody'
    bodyParams.day = peak.label
    bodyParams.load = peak.total
  }

  return {
    completedCount: done,
    completedFocusCount: completedFocus.length,
    openRemaining: remaining,
    overdueCount: overdue.length,
    peakDayKey: peak && peak.total > 0 ? peak.label : null,
    peakLoad: peak?.total ?? 0,
    winTitles,
    headlineKey,
    bodyKey,
    bodyParams,
    progressPercent,
  }
}
