import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import type { Board, BoardColumn, Priority, Task } from '../../types'
import { useTaskTimeStore } from '../../store/taskTimeStore'
import { useBoardMilestonesStore } from '../../store/boardMilestonesStore'
import { useAuthStore } from '../../store/authStore'
import { DonutChart, AvatarStack } from '../dashboard/FocusVisuals'
import DashboardSectionHeader from '../dashboard/DashboardSectionHeader'
import PriorityBadge from '../tasks/PriorityBadge'
import TaskTimer from '../tasks/TaskTimer'
import ProjectTimeReport from './ProjectTimeReport'
import { formatFriendlyDate, isOverdue, todayISO } from '../../utils/date'
import { formatHM } from '../../utils/worktime'

export type DashboardPeriod = 'today' | 'week' | 'month'

interface Props {
  board: Board
  tasks: Task[]
  progressFilter: 'all' | 'mine'
  loading?: boolean
  onOpenSettings: () => void
  onAddTask: () => void
  onTaskClick: (task: Task) => void
  onSwitchToBoard: () => void
}

type TaskStatus = 'done' | 'in_progress' | 'pending' | 'overdue'

function cardClass(extra = '') {
  return `rounded-2xl border border-gray-100/80 bg-white p-4 shadow-apple-sm dark:border-racing-800 dark:bg-racing-900 ${extra}`
}

function periodRange(period: DashboardPeriod, offset = 0): { start: Date; end: Date } {
  const now = new Date()
  if (period === 'today') {
    const day = subDays(now, offset)
    return { start: day, end: day }
  }
  if (period === 'week') {
    const anchor = subWeeks(now, offset)
    return {
      start: startOfWeek(anchor, { weekStartsOn: 1 }),
      end: endOfWeek(anchor, { weekStartsOn: 1 }),
    }
  }
  const anchor = subMonths(now, offset)
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) }
}

function dateInRange(iso: string, start: Date, end: Date): boolean {
  try {
    const d = parseISO(iso)
    return isWithinInterval(d, { start, end })
  } catch {
    return false
  }
}

function getTaskStatus(task: Task, columns: BoardColumn[]): TaskStatus {
  if (task.completed) return 'done'
  if (task.dueDate && isOverdue(task.dueDate)) return 'overdue'
  if (!task.columnId) return 'pending'
  const idx = columns.findIndex((c) => c.id === task.columnId)
  if (idx <= 0) return 'pending'
  if (idx >= columns.length - 1 && columns.length > 1) return 'in_progress'
  return 'in_progress'
}

function statusPill(status: TaskStatus, t: (k: string) => string) {
  const map: Record<TaskStatus, string> = {
    done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    pending: 'bg-gray-100 text-gray-600 dark:bg-racing-800 dark:text-racing-200',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  }
  const labels: Record<TaskStatus, string> = {
    done: t('projectDashboard.statusDone'),
    in_progress: t('projectDashboard.statusInProgress'),
    pending: t('projectDashboard.statusPending'),
    overdue: t('projectDashboard.statusOverdue'),
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${map[status]}`}>
      {labels[status]}
    </span>
  )
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={`${cardClass()} animate-pulse`}>
          <div className="mb-2 h-3 w-16 rounded bg-gray-200 dark:bg-racing-700" />
          <div className="h-7 w-10 rounded bg-gray-200 dark:bg-racing-700" />
        </div>
      ))}
    </div>
  )
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null
  const pct = previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 100)
  if (pct === 0) return null
  const up = pct > 0
  return (
    <span className={`mt-1 flex items-center gap-0.5 text-[10px] font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? '+' : ''}{pct}%
    </span>
  )
}

export default function ProjectDashboard({
  board,
  tasks,
  progressFilter,
  loading = false,
  onOpenSettings,
  onAddTask,
  onTaskClick,
  onSwitchToBoard,
}: Props) {
  const { t, i18n } = useTranslation('boards')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const currentUserId = useAuthStore((s) => s.user?.id)
  const entries = useTaskTimeStore((s) => s.entries.filter((e) => e.boardId === board.id))
  const fetchByBoard = useTaskTimeStore((s) => s.fetchByBoard)
  const getBoardSummary = useTaskTimeStore((s) => s.getBoardSummary)
  const getTaskMinutes = useTaskTimeStore((s) => s.getTaskMinutes)
  const milestones = useBoardMilestonesStore((s) => s.milestones.filter((m) => m.boardId === board.id))
  const fetchMilestones = useBoardMilestonesStore((s) => s.fetchByBoard)

  const [period, setPeriod] = useState<DashboardPeriod>('week')
  const [taskSearch, setTaskSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [showTimeDetails, setShowTimeDetails] = useState(false)

  useEffect(() => {
    void fetchByBoard(board.id)
    void fetchMilestones(board.id)
  }, [board.id, fetchByBoard, fetchMilestones])

  const visibleTasks = useMemo(() => {
    if (progressFilter === 'mine' && currentUserId) {
      return tasks.filter(
        (tk) =>
          tk.assignedTo === currentUserId ||
          tk.assigneeIds?.includes(currentUserId) ||
          (!tk.assignedTo && !tk.assigneeIds?.length && tk.ownerId === currentUserId)
      )
    }
    return tasks
  }, [tasks, progressFilter, currentUserId])

  const metrics = useMemo(() => {
    const cur = periodRange(period, 0)
    const prev = periodRange(period, 1)

    const countDoneInRange = (range: { start: Date; end: Date }) =>
      visibleTasks.filter((tk) => tk.completed && tk.completedAt && dateInRange(tk.completedAt, range.start, range.end)).length

    const hoursInRange = (range: { start: Date; end: Date }) =>
      entries
        .filter((e) => dateInRange(e.date, range.start, range.end))
        .reduce((s, e) => s + e.minutes, 0)

    const openTasks = visibleTasks.filter((tk) => !tk.completed)
    const inProgress = openTasks.filter((tk) => getTaskStatus(tk, board.columns) === 'in_progress').length
    const pending = openTasks.filter((tk) => getTaskStatus(tk, board.columns) === 'pending').length
    const overdue = openTasks.filter((tk) => getTaskStatus(tk, board.columns) === 'overdue').length
    const doneAll = visibleTasks.filter((tk) => tk.completed).length

    const prevOpen = visibleTasks.filter((tk) => !tk.completed).length
    const prevDone = countDoneInRange(prev)

    return {
      done: countDoneInRange(cur) || doneAll,
      donePrev: prevDone,
      inProgress,
      inProgressPrev: Math.max(0, inProgress - (countDoneInRange(cur) - prevDone)),
      pending,
      pendingPrev: pending,
      overdue,
      overduePrev: overdue,
      hours: hoursInRange(cur),
      hoursPrev: hoursInRange(prev),
      openTasks,
      doneAll,
      backlog: openTasks.filter((tk) => getTaskStatus(tk, board.columns) === 'pending').length,
    }
  }, [visibleTasks, board.columns, entries, period])

  const summary = getBoardSummary(board.id, tasks.map((tk) => tk.id))

  const filteredTableTasks = useMemo(() => {
    let list = visibleTasks.filter((tk) => !tk.completed || period !== 'today')
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase()
      list = list.filter((tk) => tk.title.toLowerCase().includes(q))
    }
    if (statusFilter !== 'all') {
      list = list.filter((tk) => getTaskStatus(tk, board.columns) === statusFilter)
    }
    return list
      .sort((a, b) => {
        const sa = getTaskStatus(a, board.columns)
        const sb = getTaskStatus(b, board.columns)
        const order: Record<TaskStatus, number> = { overdue: 0, in_progress: 1, pending: 2, done: 3 }
        if (order[sa] !== order[sb]) return order[sa] - order[sb]
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
        if (a.dueDate) return -1
        if (b.dueDate) return 1
        return a.title.localeCompare(b.title)
      })
      .slice(0, 50)
  }, [visibleTasks, taskSearch, statusFilter, board.columns, period])

  const weekDays = useMemo(() => {
    const { start, end } = periodRange('week', 0)
    return eachDayOfInterval({ start, end })
  }, [])

  const dailyHours = useMemo(() => {
    return weekDays.map((day) => {
      const iso = format(day, 'yyyy-MM-dd')
      const mins = entries.filter((e) => e.date === iso).reduce((s, e) => s + e.minutes, 0)
      return { day, mins, label: format(day, 'EEE', { locale: dateLocale }) }
    })
  }, [weekDays, entries, dateLocale])

  const maxDayMins = Math.max(...dailyHours.map((d) => d.mins), 1)

  const timelineTasks = useMemo(() => {
    return visibleTasks
      .filter((tk) => tk.dueDate && !tk.completed)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      .slice(0, 8)
  }, [visibleTasks])

  const teamMembers = useMemo(() => {
    const members: { id: string; name: string; color: string; role: string; open: number }[] = []
    const ownerProfile = board.members.find((m) => m.userId === board.ownerId)?.profile
    if (board.ownerId) {
      members.push({
        id: board.ownerId,
        name: ownerProfile?.display_name ?? t('detail.me'),
        color: ownerProfile?.avatar_color ?? board.color,
        role: t('detail.owner'),
        open: visibleTasks.filter((tk) => !tk.completed && (tk.assignedTo === board.ownerId || tk.ownerId === board.ownerId)).length,
      })
    }
    for (const m of board.members) {
      if (m.userId === board.ownerId) continue
      members.push({
        id: m.userId,
        name: m.profile.display_name,
        color: m.profile.avatar_color,
        role: m.role === 'owner' ? t('detail.owner') : t('projectDashboard.roleMember'),
        open: visibleTasks.filter((tk) => !tk.completed && (tk.assignedTo === m.userId || tk.assigneeIds?.includes(m.userId))).length,
      })
    }
    return members
  }, [board, visibleTasks, t])

  const donutSegments = useMemo(() => {
    const done = visibleTasks.filter((tk) => tk.completed).length
    const inProg = metrics.openTasks.filter((tk) => getTaskStatus(tk, board.columns) === 'in_progress').length
    const backlog = metrics.openTasks.filter((tk) => getTaskStatus(tk, board.columns) === 'pending').length
    const overdue = metrics.openTasks.filter((tk) => getTaskStatus(tk, board.columns) === 'overdue').length
    return [
      { value: done, color: 'var(--accent)' },
      { value: inProg, color: '#3B82F6' },
      { value: backlog, color: '#9CA3AF' },
      { value: overdue, color: '#EF4444' },
    ].filter((s) => s.value > 0)
  }, [visibleTasks, metrics.openTasks, board.columns])

  const progressPct = visibleTasks.length === 0 ? 0 : Math.round((metrics.doneAll / visibleTasks.length) * 100)

  const periodTabs: { id: DashboardPeriod; label: string }[] = [
    { id: 'today', label: t('projectDashboard.periodToday') },
    { id: 'week', label: t('projectDashboard.periodWeek') },
    { id: 'month', label: t('projectDashboard.periodMonth') },
  ]

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <KpiSkeleton />
        <div className={`${cardClass()} h-48 animate-pulse bg-gray-50 dark:bg-racing-800`} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DashboardSectionHeader
          title={t('projectDashboard.title')}
          subtitle={t('projectDashboard.subtitle')}
          className="mb-0"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 p-0.5 dark:border-racing-700">
            {periodTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === tab.id
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onAddTask}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-accent-dark"
          >
            <Plus size={14} />
            {t('projectDashboard.addTask')}
          </button>
          <button
            type="button"
            onClick={onSwitchToBoard}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            <LayoutGrid size={14} />
            {t('projectDashboard.openBoard')}
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: t('projectDashboard.kpiDone'), value: metrics.done, prev: metrics.donePrev, color: 'text-accent' },
          { label: t('projectDashboard.kpiInProgress'), value: metrics.inProgress, prev: metrics.inProgressPrev, color: 'text-blue-600' },
          { label: t('projectDashboard.kpiPending'), value: metrics.pending, prev: metrics.pendingPrev, color: 'text-gray-600 dark:text-racing-200' },
          { label: t('projectDashboard.kpiOverdue'), value: metrics.overdue, prev: metrics.overduePrev, color: metrics.overdue > 0 ? 'text-red-500' : 'text-gray-600' },
          { label: t('projectDashboard.kpiHours'), value: formatHM(metrics.hours), prev: metrics.hoursPrev, color: 'text-amber-600', isTime: true },
        ].map((kpi) => (
          <div key={kpi.label} className={cardClass()}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${kpi.color}`}>
              {kpi.isTime ? kpi.value : kpi.value}
            </p>
            {!kpi.isTime && <TrendBadge current={kpi.value as number} previous={kpi.prev as number} />}
            {kpi.isTime && <TrendBadge current={metrics.hours} previous={metrics.hoursPrev} />}
            <p className="mt-0.5 text-[10px] text-gray-400">{t('projectDashboard.vsPrevious')}</p>
          </div>
        ))}
      </div>

      {/* Bento middle row */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Timeline */}
        <div className={`${cardClass()} lg:col-span-7`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Calendar size={14} className="text-accent" />
              {t('projectDashboard.timeline')}
            </h3>
            {board.deadline && (
              <span className={`text-xs ${isOverdue(board.deadline) ? 'font-medium text-red-500' : 'text-gray-400'}`}>
                {t('detail.deadline', { date: formatFriendlyDate(board.deadline) })}
              </span>
            )}
          </div>
          {timelineTasks.length === 0 && milestones.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar size={28} className="mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">{t('projectDashboard.timelineEmpty')}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {milestones.slice(0, 3).map((ms) => (
                <div key={ms.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-racing-800">
                  <span className={`h-2 w-2 rounded-full ${ms.completed ? 'bg-accent' : 'bg-amber-400'}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{ms.title}</span>
                  <span className="text-xs text-gray-400">{formatFriendlyDate(ms.dueDate)}</span>
                </div>
              ))}
              {timelineTasks.map((tk) => {
                const col = board.columns.find((c) => c.id === tk.columnId)
                const pct = tk.completed ? 100 : col ? Math.max(20, Math.round(((board.columns.findIndex((c) => c.id === tk.columnId) + 1) / board.columns.length) * 100)) : 10
                const assignees = tk.assignee
                  ? [{ id: tk.assignee.id, name: tk.assignee.display_name, color: tk.assignee.avatar_color }]
                  : []
                return (
                  <button
                    key={tk.id}
                    type="button"
                    onClick={() => onTaskClick(tk)}
                    className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2 text-left hover:border-gray-100 hover:bg-gray-50 dark:hover:border-racing-700 dark:hover:bg-racing-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="truncate text-sm font-medium group-hover:text-accent">{tk.title}</span>
                        {assignees.length > 0 && <AvatarStack people={assignees} max={2} />}
                      </div>
                      <div className="relative h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-racing-700">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: board.color }}
                        />
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-xs text-gray-400">{formatFriendlyDate(tk.dueDate)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Progress donut + team */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className={cardClass()}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <BarChart3 size={14} className="text-accent" />
              {t('projectDashboard.progress')}
            </h3>
            {visibleTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">{t('projectDashboard.noTasks')}</p>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <DonutChart
                  segments={donutSegments.length > 0 ? donutSegments : [{ value: 1, color: '#E5E7EB' }]}
                  size={110}
                  stroke={14}
                  centerLabel={`${progressPct}%`}
                  centerSub={t('projectDashboard.completed')}
                />
                <div className="flex flex-col gap-2 text-xs">
                  {[
                    { label: t('projectDashboard.legendDone'), count: metrics.doneAll, color: 'var(--accent)' },
                    { label: t('projectDashboard.legendInProgress'), count: metrics.inProgress, color: '#3B82F6' },
                    { label: t('projectDashboard.legendBacklog'), count: metrics.backlog, color: '#9CA3AF' },
                    { label: t('projectDashboard.legendOverdue'), count: metrics.overdue, color: '#EF4444' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-500 dark:text-racing-300">{item.label}</span>
                      <span className="ml-auto font-bold tabular-nums">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={cardClass()}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Users size={14} className="text-accent" />
              {t('projectDashboard.team')}
            </h3>
            {teamMembers.length === 0 ? (
              <p className="text-sm text-gray-400">{t('projectDashboard.teamEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-racing-800">
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.name}</p>
                      <p className="text-[10px] text-gray-400">{m.role}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums dark:bg-racing-900">
                      {m.open}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Time tracking row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cardClass()}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Clock size={14} className="text-accent" />
              {t('projectDashboard.timeThisWeek')}
            </h3>
            <button
              type="button"
              onClick={() => setShowTimeDetails((v) => !v)}
              className="text-xs font-medium text-accent hover:underline"
            >
              {showTimeDetails ? t('projectDashboard.hideTimeReport') : t('projectDashboard.showTimeReport')}
            </button>
          </div>
          <div className="mb-2 flex items-end justify-between gap-1" style={{ height: 80 }}>
            {dailyHours.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-accent/80 to-accent/40 transition-all"
                    style={{ height: `${Math.max(4, (d.mins / maxDayMins) * 100)}%`, minHeight: d.mins > 0 ? 8 : 4 }}
                    title={formatHM(d.mins)}
                  />
                </div>
                <span className="text-[9px] font-medium uppercase text-gray-400">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-racing-800">
            <div>
              <p className="text-xs text-gray-400">{t('projectDashboard.totalLogged')}</p>
              <p className="text-lg font-bold tabular-nums">{formatHM(summary.totalMinutes)}</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTimeDetails(true)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
            >
              <Plus size={12} />
              {t('projectDashboard.logTime')}
            </button>
          </div>
        </div>

        <div className={cardClass()}>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 size={14} className="text-accent" />
            {t('projectDashboard.quickStats')}
          </h3>
          <div className="flex flex-col gap-3">
            {[
              { label: t('projectDashboard.statCompletion'), value: progressPct, max: 100, color: board.color },
              {
                label: t('projectDashboard.statBudget'),
                value: board.timeBudgetMinutes ? Math.min(100, Math.round((summary.totalMinutes / board.timeBudgetMinutes) * 100)) : 0,
                max: 100,
                color: '#F59E0B',
                hidden: !board.timeBudgetMinutes,
              },
              {
                label: t('projectDashboard.statOpen'),
                value: metrics.openTasks.length,
                max: Math.max(visibleTasks.length, 1),
                color: '#3B82F6',
              },
            ]
              .filter((s) => !s.hidden)
              .map((stat) => (
                <div key={stat.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-gray-500">{stat.label}</span>
                    <span className="font-semibold tabular-nums">
                      {stat.max === 100 ? `${stat.value}%` : stat.value}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-racing-700">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, (stat.value / stat.max) * 100)}%`, backgroundColor: stat.color }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Task table */}
      <div className={cardClass('!p-0 overflow-hidden')}>
        <div className="border-b border-gray-100 p-4 dark:border-racing-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{t('projectDashboard.myTasks')}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder={t('projectDashboard.searchTasks')}
                  className="rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs dark:border-racing-700 dark:bg-racing-800"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')}
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs dark:border-racing-700 dark:bg-racing-800"
              >
                <option value="all">{t('projectDashboard.filterAll')}</option>
                <option value="overdue">{t('projectDashboard.statusOverdue')}</option>
                <option value="in_progress">{t('projectDashboard.statusInProgress')}</option>
                <option value="pending">{t('projectDashboard.statusPending')}</option>
                <option value="done">{t('projectDashboard.statusDone')}</option>
              </select>
            </div>
          </div>
        </div>

        {filteredTableTasks.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <p className="text-sm text-gray-400">{t('projectDashboard.tasksEmpty')}</p>
            <button type="button" onClick={onAddTask} className="mt-3 text-sm font-medium text-accent hover:underline">
              {t('projectDashboard.addTask')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:border-racing-800">
                  <th className="px-4 py-2.5">{t('projectDashboard.colTask')}</th>
                  <th className="px-4 py-2.5">{t('projectDashboard.colStatus')}</th>
                  <th className="px-4 py-2.5">{t('projectDashboard.colPriority')}</th>
                  <th className="px-4 py-2.5">{t('projectDashboard.colAssignee')}</th>
                  <th className="px-4 py-2.5">{t('projectDashboard.colDeadline')}</th>
                  <th className="px-4 py-2.5">{t('projectDashboard.colTime')}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredTableTasks.map((tk) => {
                  const status = getTaskStatus(tk, board.columns)
                  const mins = getTaskMinutes(tk.id)
                  return (
                    <tr
                      key={tk.id}
                      className="border-b border-gray-50 hover:bg-gray-50/80 dark:border-racing-800/50 dark:hover:bg-racing-800/50"
                    >
                      <td className="px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => onTaskClick(tk)}
                          className="max-w-[200px] truncate text-left font-medium hover:text-accent"
                        >
                          {tk.title}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">{statusPill(status, t)}</td>
                      <td className="px-4 py-2.5">
                        <PriorityBadge priority={tk.priority as Priority} />
                      </td>
                      <td className="px-4 py-2.5">
                        {tk.assignee ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white"
                              style={{ backgroundColor: tk.assignee.avatar_color }}
                            >
                              {tk.assignee.display_name.slice(0, 2).toUpperCase()}
                            </span>
                            <span className="hidden truncate sm:inline">{tk.assignee.display_name}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {tk.dueDate ? (
                          <span className={status === 'overdue' ? 'font-medium text-red-500' : ''}>
                            {formatFriendlyDate(tk.dueDate)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-mono font-semibold tabular-nums">{formatHM(mins)}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {!tk.completed && (
                          <TaskTimer taskId={tk.id} boardId={board.id} title={tk.title} compact />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTimeDetails && (
        <div className="mt-2">
          <ProjectTimeReport board={board} tasks={tasks} onOpenSettings={onOpenSettings} />
        </div>
      )}
    </div>
  )
}
