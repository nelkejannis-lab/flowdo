import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Clock, Users, BarChart3, Building2, TrendingUp } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useTasksStore } from '../store/tasksStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { useBoardsStore } from '../store/boardsStore'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import { useWorkTimeStore } from '../store/workTimeStore'
import { useTaskTimeStore } from '../store/taskTimeStore'
import { useMeetingsStore } from '../store/meetingsStore'
import { useOrganizationStore } from '../store/organizationStore'
import { useAuthStore } from '../store/authStore'
import { canApproveAbsences, canManageTeams } from '../lib/roles'
import CapacityTracker from '../components/admin/CapacityTracker'
import Sparkline from '../components/social/Sparkline'
import { DonutChart } from '../components/dashboard/FocusVisuals'
import { calendarMinutesByDay, computeTaskStats, eisenhowerDistribution, getPeriodRange, sparklines, taskTimeMinutesByDay, workMinutesByDay, type StatisticsPeriod } from '../lib/statistics'
import { formatHM } from '../utils/worktime'
import { todayISO } from '../utils/date'
import type { Task } from '../types'
import { isSupabaseConfigured } from '../lib/supabase'

function completedISO(completedAt?: string): string | undefined {
  if (!completedAt) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(completedAt)) return completedAt
  try {
    const d = parseISO(completedAt)
    if (Number.isNaN(d.getTime())) return undefined
    return format(d, 'yyyy-MM-dd')
  } catch {
    return undefined
  }
}

function inRange(dayISO: string, startISO: string, endISO: string) {
  return dayISO >= startISO && dayISO <= endISO
}

function isFocusTask(t: Pick<Task, 'urgent' | 'important' | 'priority'>) {
  return t.urgent || t.important || t.priority === 'high'
}

function MinutesKpiCard({
  icon,
  title,
  valueMinutes,
  sub,
}: {
  icon: ReactNode
  title: string
  valueMinutes: number
  sub?: string
}) {
  return (
    <div className="bento-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
          <span className="text-accent">{icon}</span>
          <span>{title}</span>
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{Math.round(valueMinutes)} </div>
      <div className="mt-0.5 text-xs text-gray-500">{sub}</div>
    </div>
  )
}

function SparkCard({
  title,
  total,
  values,
  color,
}: {
  title: string
  total: string
  values: number[]
  color: string
}) {
  return (
    <div className="bento-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{total}</p>
        </div>
      </div>

      {values.length >= 2 ? (
        <div className="mt-4">
          <Sparkline values={values} color={color} width={260} height={48} />
        </div>
      ) : (
        <div className="mt-4 h-[48px] flex items-center justify-center text-xs text-gray-400">
          Demnächst verfügbar
        </div>
      )}
    </div>
  )
}

export default function StatistikenPage() {
  const { t } = useTranslation('statistics')
  const [period, setPeriod] = useState<StatisticsPeriod>('today')

  const range = useMemo(() => getPeriodRange(period), [period])
  const today = todayISO()

  const fetchTasks = useTasksStore((s) => s.fetchAll)
  const tasks = useTasksStore((s) => s.tasks)
  const fetchMyProjectTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)

  const fetchCalendarEntries = useCalendarEntriesStore((s) => s.fetchEntries)
  const calendarEntries = useCalendarEntriesStore((s) => s.entries)

  const fetchWorkTime = useWorkTimeStore((s) => s.fetchAll)
  const workEntries = useWorkTimeStore((s) => s.entries)
  const workSettings = useWorkTimeStore((s) => s.settings)

  const fetchTaskTime = useTaskTimeStore((s) => s.fetchForUser)
  const taskTimeEntries = useTaskTimeStore((s) => s.entries)

  const fetchMeetings = useMeetingsStore((s) => s.fetchMeetings)
  const meetings = useMeetingsStore((s) => s.meetings)

  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const boards = useBoardsStore((s) => s.boards)
  const boardTaskStats = useBoardsStore((s) => s.taskStats)

  const fetchOrg = useOrganizationStore((s) => s.fetch)
  const myRole = useOrganizationStore((s) => s.myRole)
  const profile = useAuthStore((s) => s.profile)

  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(false)
    if (!isSupabaseConfigured) {
      setLoaded(true)
      return
    }
    void Promise.allSettled([
      fetchTasks(),
      fetchMyProjectTasks(),
      fetchBoards(),
      fetchCalendarEntries(),
      fetchWorkTime(),
      fetchTaskTime(),
      fetchMeetings(),
      fetchOrg(),
    ]).finally(() => setLoaded(true))
  }, [fetchTasks, fetchMyProjectTasks, fetchBoards, fetchCalendarEntries, fetchWorkTime, fetchTaskTime, fetchMeetings, fetchOrg])

  const allTasks = useMemo(() => [...tasks, ...myProjectTasks], [tasks, myProjectTasks])

  const taskStats = useMemo(
    () => computeTaskStats(allTasks, range.startISO, range.endISO, today),
    [allTasks, range.startISO, range.endISO, today],
  )

  const workSeries = useMemo(() => workMinutesByDay(workEntries, workSettings, range.dayISOs), [workEntries, workSettings, range.dayISOs])
  const workActualTotal = workSeries.actual.reduce((s, v) => s + v, 0)
  const workTargetTotal = workSeries.target.reduce((s, v) => s + v, 0)

  const calendarSeries = useMemo(() => calendarMinutesByDay(calendarEntries, range.dayISOs, { includeTypes: ['termin'] }), [calendarEntries, range.dayISOs])
  const calendarTotal = calendarSeries.reduce((s, v) => s + v, 0)

  const taskTimeSeries = useMemo(
    () => taskTimeMinutesByDay(taskTimeEntries.filter((e) => inRange(e.date, range.startISO, range.endISO)), range.dayISOs),
    [taskTimeEntries, range.startISO, range.endISO, range.dayISOs],
  )
  const taskTimeTotal = taskTimeSeries.reduce((s, v) => s + v, 0)

  const meetingsInPeriod = useMemo(
    () => meetings.filter((m) => inRange(m.date, range.startISO, range.endISO)),
    [meetings, range.startISO, range.endISO],
  )

  const projectProgress = useMemo(() => {
    const rows = boards
      .map((b) => {
        const st = boardTaskStats[b.id]
        const total = st?.total ?? 0
        const done = st?.done ?? 0
        const pct = total > 0 ? Math.round((done / total) * 100) : 0
        return { board: b, total, done, pct }
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.pct - a.pct)

    const overallTotal = rows.reduce((s, r) => s + r.total, 0)
    const overallDone = rows.reduce((s, r) => s + r.done, 0)
    const overallPct = overallTotal > 0 ? Math.round((overallDone / overallTotal) * 100) : 0

    return { rows, overallPct, overallTotal, overallDone }
  }, [boards, boardTaskStats])

  const focusCompletedInPeriod = useMemo(() => {
    return allTasks.filter((t) => {
      if (!t.completed) return false
      if (!isFocusTask(t)) return false
      const d = completedISO(t.completedAt)
      return d ? inRange(d, range.startISO, range.endISO) : false
    })
  }, [allTasks, range.startISO, range.endISO])

  const eisenSegments = useMemo(() => eisenhowerDistribution(focusCompletedInPeriod), [focusCompletedInPeriod])

  const showManagerTools = canApproveAbsences(profile, myRole) || canManageTeams(profile, myRole)

  const hasAnyData =
    loaded &&
    (allTasks.length > 0 || calendarEntries.length > 0 || Object.keys(workEntries).length > 0 || taskTimeEntries.length > 0 || meetings.length > 0 || boards.length > 0)

  const workTargetTotalLabel = workTargetTotal > 0 ? `${formatHM(workActualTotal)} / ${formatHM(workTargetTotal)}` : formatHM(workActualTotal)

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
            <BarChart3 size={22} className="text-accent" />
            {t('page.title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('page.intro')}</p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium dark:bg-racing-800">
            {(['today', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  period === p ? 'bg-white shadow-sm dark:bg-racing-700' : 'text-gray-400'
                }`}
              >
                {p === 'today' ? t('tabs.today') : p === 'week' ? t('tabs.week') : t('tabs.month')}
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-400">
            {range.startISO} – {range.endISO}
          </div>
        </div>
      </div>

      {!hasAnyData ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <CalendarDays size={44} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">{t('empty.title')}</p>
          <p className="mt-1 text-xs text-center max-w-xl">{t('empty.body')}</p>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="bento-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                  <span className="text-accent">
                    <Building2 size={16} />
                  </span>
                  {t('kpi.openTasks')}
                </div>
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{taskStats.open}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                {t('kpi.dueInPeriod', { count: taskStats.dueInPeriodOpen })}
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                  <span className="text-accent">
                    <TrendingUp size={16} />
                  </span>
                  {t('kpi.completedInPeriod')}
                </div>
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{taskStats.completedInPeriod}</div>
              <div className="mt-0.5 text-xs text-gray-500">
                {t('kpi.completedFocus', { count: taskStats.completedFocusInPeriod })}
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                  <span className="text-accent">
                    <Users size={16} />
                  </span>
                  {t('kpi.focusStreak')}
                </div>
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-white">{taskStats.focusStreak}</div>
              <div className="mt-0.5 text-xs text-gray-500">{t('kpi.focusStreakHint')}</div>
            </div>
          </div>

          {/* Charts section */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
            <div className="bento-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('charts.eisenhowerTitle')}</h2>
                  <p className="mt-1 text-xs text-gray-500">{t('charts.eisenhowerSub')}</p>
                </div>
                <div className="text-xs text-gray-400">{focusCompletedInPeriod.length} {t('charts.tasks')}</div>
              </div>

              <div className="mt-4 flex flex-col items-center gap-4">
                <DonutChart
                  size={164}
                  stroke={12}
                  segments={eisenSegments}
                  centerLabel={String(focusCompletedInPeriod.length)}
                  centerSub={t('charts.completedFocus')}
                />

                <div className="w-full">
                  {eisenSegments.map((s) => (
                    <div key={s.quadrant} className="mt-2 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-racing-200">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        {t(`eisen.${s.quadrant}`)}
                      </div>
                      <span className="font-semibold tabular-nums">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="bento-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('charts.workMinutes')}</h2>
                      <p className="mt-1 text-xs text-gray-500">{workTargetTotalLabel}</p>
                    </div>
                    <span className="text-accent">
                      <Clock size={16} />
                    </span>
                  </div>
                  {range.dayISOs.length >= 2 ? (
                    <div className="mt-4">
                      <Sparkline values={sparklines(workSeries.actual)} color="rgb(71 114 250)" width={260} height={48} />
                    </div>
                  ) : (
                    <div className="mt-4 h-[48px] flex items-center justify-center text-xs text-gray-400">{t('charts.sparklinesNotEnoughData')}</div>
                  )}
                </div>

                <div className="bento-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('charts.calendarMinutes')}</h2>
                      <p className="mt-1 text-xs text-gray-500">{formatHM(calendarTotal)}</p>
                    </div>
                    <span className="text-accent">
                      <CalendarDays size={16} />
                    </span>
                  </div>
                  {range.dayISOs.length >= 2 ? (
                    <div className="mt-4">
                      <Sparkline values={sparklines(calendarSeries)} color="rgb(167 139 250)" width={260} height={48} />
                    </div>
                  ) : (
                    <div className="mt-4 h-[48px] flex items-center justify-center text-xs text-gray-400">{t('charts.sparklinesNotEnoughData')}</div>
                  )}
                </div>

                <div className="bento-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('charts.taskTimeMinutes')}</h2>
                      <p className="mt-1 text-xs text-gray-500">{formatHM(taskTimeTotal)}</p>
                    </div>
                    <span className="text-accent">
                      <Clock size={16} />
                    </span>
                  </div>
                  {range.dayISOs.length >= 2 ? (
                    <div className="mt-4">
                      <Sparkline values={sparklines(taskTimeSeries)} color="rgb(16 185 129)" width={260} height={48} />
                    </div>
                  ) : (
                    <div className="mt-4 h-[48px] flex items-center justify-center text-xs text-gray-400">{t('charts.sparklinesNotEnoughData')}</div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
                <div className="bento-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('sections.projectProgress')}</h2>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('sections.projectProgressHint', { pct: projectProgress.overallPct })}
                      </p>
                    </div>
                  </div>

                  {projectProgress.rows.length === 0 ? (
                    <div className="mt-4 text-sm text-gray-400">{t('empty.projectProgress')}</div>
                  ) : (
                    <div className="mt-4 flex flex-col gap-3">
                      {projectProgress.rows.slice(0, 6).map((r) => (
                        <div key={r.board.id} className="flex items-center gap-3">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.board.color }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium text-gray-700 dark:text-racing-100">{r.board.title}</p>
                              <p className="text-xs font-semibold tabular-nums text-gray-700 dark:text-white">{r.pct}%</p>
                            </div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-racing-700">
                              <div className="h-full rounded-full bg-accent" style={{ width: `${r.pct}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bento-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('sections.meetings')}</h2>
                      <p className="mt-1 text-xs text-gray-500">
                        {t('sections.meetingsSub', { count: meetingsInPeriod.length })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-gray-700 dark:text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">{t('kpi.meetings')}</span>
                      <span className="font-semibold tabular-nums">{meetingsInPeriod.length}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-gray-500">{t('kpi.calendarMinutes')}</span>
                      <span className="font-semibold tabular-nums">{formatHM(calendarTotal)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-gray-500">{t('kpi.taskTimeMinutes')}</span>
                      <span className="font-semibold tabular-nums">{formatHM(taskTimeTotal)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {showManagerTools && (
                <div className="bento-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{t('manager.title')}</h2>
                      <p className="mt-1 text-xs text-gray-500">{t('manager.description')}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <CapacityTracker />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
