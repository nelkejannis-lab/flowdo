import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Play,
  Square,
  Pause,
  Users,
  Clock,
  ListTodo,
} from 'lucide-react'
import { DonutChart, ProgressTrack, AvatarStack } from './FocusVisuals'
import type { DayReadinessResult } from '../../lib/dayReadiness'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { isOverdue } from '../../utils/date'
import TaskTimer from '../tasks/TaskTimer'
import { useBoardsStore } from '../../store/boardsStore'
import { resolveTaskLifeArea } from '../../lib/lifeArea'
import LifeAreaBadge from '../shared/LifeAreaBadge'

interface TodayTodo {
  id: string
  title: string
  priority: string
  urgent: boolean
  important: boolean
  dueDate?: string
  startTime?: string
  boardId?: string
  completed: boolean
  lifeArea?: 'work' | 'private'
}

interface PriorityTask {
  id: string
  title: string
  priority: string
}

interface DayEvent {
  id: string
  title: string
  startTime?: string
  endTime?: string
  durationMin: number
}

interface Colleague {
  id: string
  name: string
  avatarUrl?: string
  color?: string
}

interface DoneStats {
  tasksCompleted: number
  tasksTotal: number
  meetingsToday: number
  meetingsDone: number
  trackedLabel: string
  targetLabel: string
}

interface Props {
  dayLabel: string
  todayEvents?: DayEvent[]
  priorities: PriorityTask[]
  todayTodos: TodayTodo[]
  capacityPercent: number
  workedLabel: string
  targetLabel: string
  workStatus?: string | null
  colleagues?: Colleague[]
  readiness: DayReadinessResult
  doneStats: DoneStats
  onPlanDay?: () => void
  onOpenBriefing?: () => void
  onPrioritizeDay?: () => void
  onOpenEvening?: () => void
  onOpenTimeline?: () => void
  onOpenJournal?: () => void
  onToggleTodo?: (task: TodayTodo) => void
  onOpenTodo?: (task: TodayTodo) => void
}

export default function TodayHero({
  dayLabel,
  todayEvents = [],
  priorities,
  todayTodos,
  capacityPercent,
  workedLabel,
  targetLabel,
  workStatus,
  colleagues = [],
  readiness,
  doneStats,
  onPlanDay,
  onOpenBriefing,
  onPrioritizeDay,
  onOpenEvening,
  onOpenTimeline,
  onOpenJournal,
  onToggleTodo,
  onOpenTodo,
}: Props) {
  const { t } = useTranslation('dashboard')
  const boards = useBoardsStore((s) => s.boards)

  const capped = Math.min(100, Math.max(0, capacityPercent))
  const free = Math.max(0, 100 - capped)

  const donePct =
    doneStats.tasksTotal > 0
      ? Math.round((doneStats.tasksCompleted / doneStats.tasksTotal) * 100)
      : doneStats.tasksCompleted > 0
        ? 100
        : 0

  const meetingsOpen = Math.max(0, doneStats.meetingsToday - doneStats.meetingsDone)

  const isRunning = useWorkTimeStore((s) => s.isRunning)
  const isOnBreak = useWorkTimeStore((s) => s.isOnBreak)
  const breakStartedAt = useWorkTimeStore((s) => s.breakStartedAt)
  const clockIn = useWorkTimeStore((s) => s.clockIn)
  const clockOut = useWorkTimeStore((s) => s.clockOut)
  const startBreak = useWorkTimeStore((s) => s.startBreak)
  const endBreak = useWorkTimeStore((s) => s.endBreak)

  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!isRunning && !isOnBreak) return
    const id = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [isRunning, isOnBreak])

  const breakElapsedSec =
    isOnBreak && breakStartedAt
      ? Math.floor((Date.now() - new Date(breakStartedAt).getTime()) / 1000)
      : 0
  const breakTimerLabel = formatBreakElapsed(breakElapsedSec)

  const openTodos = todayTodos.filter((tk) => !tk.completed)
  const workTodos = openTodos.filter((tk) => resolveTaskLifeArea(tk, boards) === 'work')
  const privateTodos = openTodos.filter((tk) => resolveTaskLifeArea(tk, boards) === 'private')

  const meetingsLabelKey = 'readiness.doneStats.meetingsHeld'

  const taskValue =
    doneStats.tasksTotal > 0
      ? t('progressPills.tasksRatio', { done: doneStats.tasksCompleted, total: doneStats.tasksTotal })
      : String(doneStats.tasksCompleted)

  const meetingValue =
    doneStats.meetingsToday > 0
      ? t('progressPills.meetingsRatio', { done: doneStats.meetingsDone, total: doneStats.meetingsToday })
      : String(doneStats.meetingsToday)

  return (
    <section className="bento-card mb-6 overflow-hidden p-5 sm:p-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t('readiness.eyebrow')}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{dayLabel}</h1>
          {workStatus && <p className="mt-1.5 text-sm text-gray-500 dark:text-racing-300">{workStatus}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onPrioritizeDay && (
            <button
              type="button"
              onClick={onPrioritizeDay}
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
            >
              {t('morningReport.actionPrioritize')}
            </button>
          )}
          {onOpenBriefing && (
            <button
              type="button"
              onClick={onOpenBriefing}
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
            >
              {t('focus.openBriefing')}
            </button>
          )}
          {onOpenEvening && (
            <button
              type="button"
              onClick={onOpenEvening}
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
            >
              {t('eveningReport.title')}
            </button>
          )}
          {onOpenJournal && (
            <button
              type="button"
              onClick={onOpenJournal}
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
            >
              {t('journal.title')}
            </button>
          )}
          {onOpenTimeline && (
            <button
              type="button"
              onClick={onOpenTimeline}
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
            >
              {t('eveningReport.whereWasTime')}
            </button>
          )}

          {onPlanDay && (
            <button
              type="button"
              onClick={onPlanDay}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-accent/20 transition hover:brightness-110 active:scale-95"
            >
              <Sparkles size={13} strokeWidth={1.8} />
              {t('focus.planDay')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Done metrics — original left column */}
        <div className="flex flex-col gap-3 lg:col-span-4">
          <MetricTile
            icon={<ListTodo size={15} className="text-accent" />}
            label={t('readiness.doneStats.tasksDone')}
            value={taskValue}
            detail={doneStats.tasksTotal > 0 ? `${donePct}%` : undefined}
          />

          <MetricTile
            icon={<Users size={15} className="text-accent" />}
            label={t(meetingsLabelKey)}
            value={meetingValue}
            detail={t('readiness.doneStats.meetingsDetail', {
              done: doneStats.meetingsDone,
              open: meetingsOpen,
            })}
          />

          <MetricTile
            icon={<Clock size={15} className="text-accent" />}
            label={t('readiness.doneStats.trackedTime')}
            value={doneStats.trackedLabel}
            detail={t('readiness.doneStats.trackedHint', { target: doneStats.targetLabel })}
          />

          <p className="pt-1 text-[10px] text-gray-400">
            {t('readiness.doneStats.readinessHint', { score: readiness.score })}
          </p>
        </div>

        {/* Today's to-dos — split Arbeit / Privat */}
        <div className="flex min-h-0 flex-col lg:col-span-5">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              <span className="h-3.5 w-1 rounded-full bg-accent/70" aria-hidden />
              {t('readiness.todayTodos')}
            </p>
            {openTodos.length > 0 && (
              <span className="text-[11px] tabular-nums text-gray-400">
                {t('readiness.todayTodosCount', { count: openTodos.length })}
              </span>
            )}
          </div>

          {openTodos.length === 0 ? (
            <DelightEmpty />
          ) : (
            <div className="flex flex-col gap-4">
              {workTodos.length > 0 && (
                <TodoSection
                  title={t('readiness.workSection')}
                  todos={workTodos.slice(0, 6)}
                  boards={boards}
                  onToggleTodo={onToggleTodo}
                  onOpenTodo={onOpenTodo}
                  t={t}
                />
              )}
              {privateTodos.length > 0 && (
                <TodoSection
                  title={t('readiness.privateSection')}
                  todos={privateTodos.slice(0, 6)}
                  boards={boards}
                  onToggleTodo={onToggleTodo}
                  onOpenTodo={onOpenTodo}
                  t={t}
                />
              )}
            </div>
          )}

          {openTodos.length > 6 && (
            <Link
              to="/tasks"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              {t('readiness.todayTodosMore', { count: openTodos.length - 6 })}
              <ArrowRight size={12} />
            </Link>
          )}
        </div>

        {/* Capacity + work-time controls */}
        <div className="flex flex-col gap-3 rounded-[20px] border border-black/[0.05] bg-gradient-to-b from-black/[0.02] to-transparent p-3.5 dark:border-white/[0.07] dark:from-white/[0.04] lg:col-span-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('focus.capacityHint')}</p>
            {isOnBreak ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                {t('readiness.workControls.onBreakTimer', { time: breakTimerLabel })}
              </span>
            ) : isRunning ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                {t('readiness.workControls.running')}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <DonutChart
              size={68}
              stroke={7}
              segments={[
                { value: capped, color: 'rgb(var(--accent))' },
                { value: free, color: 'rgba(148,163,184,0.22)' },
              ]}
              centerLabel={`${Math.round(capped)}%`}
            />

            <div className="min-w-0 flex-1">
              <p className="text-xl font-bold tabular-nums tracking-tight leading-none">{workedLabel}</p>
              <p className="mt-1 text-[11px] text-gray-400">
                {t('readiness.doneStats.trackedHint', { target: targetLabel })}
              </p>
              <ProgressTrack value={capped} className="mt-2.5" />
            </div>
          </div>

          {isOnBreak && (
            <div className="flex items-center justify-between rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 dark:border-amber-800/60 dark:bg-amber-900/25">
              <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                {t('readiness.workControls.breakDuration')}
              </span>
              <span className="text-sm font-bold tabular-nums tracking-tight text-amber-800 dark:text-amber-200">
                {breakTimerLabel}
              </span>
            </div>
          )}

          <div
            className={`flex overflow-hidden rounded-xl border ${
              isOnBreak
                ? 'border-amber-200/80 dark:border-amber-800/60'
                : isRunning
                  ? 'border-black/[0.08] dark:border-white/[0.1]'
                  : 'border-transparent'
            }`}
          >
            {!isRunning ? (
              <button
                type="button"
                onClick={clockIn}
                className="inline-flex flex-1 items-center justify-center gap-1.5 bg-accent px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-accent-dark active:scale-[0.99]"
              >
                <Play size={13} className="ml-0.5" strokeWidth={2.2} />
                {t('readiness.workControls.start')}
              </button>
            ) : (
              <>
                {isOnBreak ? (
                  <button
                    type="button"
                    onClick={endBreak}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 active:scale-[0.99] dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/45"
                  >
                    <Play size={13} className="ml-0.5" strokeWidth={2.2} />
                    {t('readiness.workControls.resume')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startBreak('pause')}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 bg-black/[0.03] px-3 py-2.5 text-xs font-semibold text-gray-700 transition hover:bg-black/[0.06] active:scale-[0.99] dark:bg-white/[0.05] dark:text-racing-100 dark:hover:bg-white/[0.08]"
                  >
                    <Pause size={13} strokeWidth={2.2} />
                    {t('readiness.workControls.pause')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={clockOut}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 border-l border-black/[0.08] bg-red-500/90 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-red-600 active:scale-[0.99] dark:border-white/[0.1]"
                >
                  <Square size={11} strokeWidth={2.4} />
                  {t('readiness.workControls.stop')}
                </button>
              </>
            )}
          </div>

          {colleagues.length > 0 && (
            <div className="flex items-center gap-2 pt-0.5">
              <AvatarStack people={colleagues} />
              <span className="text-[11px] text-gray-400">{t('focus.teamActive', { count: colleagues.length })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Termine heute — horizontal */}
      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <span className="h-3.5 w-1 rounded-full bg-accent/70" aria-hidden />
            {t('focus.todayEvents')}
          </span>
          {todayEvents.length > 0 && (
            <span className="text-[11px] tabular-nums text-gray-400">
              {t('focus.todayEventsCount', { count: todayEvents.length })}
            </span>
          )}
        </div>

        {todayEvents.length === 0 ? (
          <p className="text-sm text-gray-400">{t('focus.noEventsToday')}</p>
        ) : (
          <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 scrollbar-none">
            {todayEvents.map((ev) => (
              <div
                key={ev.id}
                className="bento-card-sm flex w-[min(100%,220px)] min-w-[168px] shrink-0 snap-start flex-col gap-1.5 p-3.5 sm:min-w-[180px]"
              >
                <div className="flex items-center gap-2 text-accent">
                  <CalendarDays size={14} strokeWidth={1.6} className="flex-shrink-0" />
                  {ev.startTime ? (
                    <span className="text-xs font-bold tabular-nums leading-none">
                      {ev.endTime ? `${ev.startTime} – ${ev.endTime}` : ev.startTime}
                    </span>
                  ) : (
                    <span className="text-xs font-semibold">{t('focus.allDay')}</span>
                  )}
                </div>
                {ev.durationMin > 0 && (
                  <span className="inline-flex w-fit rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-accent">
                    {formatEventDuration(ev.durationMin, t)}
                  </span>
                )}
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{ev.title}</p>
              </div>
            ))}
          </div>
        )}

        <Link
          to="/calendar"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          {t('calendar')} <ArrowRight size={12} />
        </Link>
      </div>
    </section>
  )
}

function TodoSection({
  title,
  todos,
  boards,
  onToggleTodo,
  onOpenTodo,
  t,
}: {
  title: string
  todos: TodayTodo[]
  boards: { id: string; lifeArea?: 'work' | 'private' }[]
  onToggleTodo?: (task: TodayTodo) => void
  onOpenTodo?: (task: TodayTodo) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {todos.map((tk) => {
          const overdue = isOverdue(tk.dueDate)
          const area = resolveTaskLifeArea(tk, boards)
          return (
            <li key={tk.id}>
              <div className="group flex w-full items-center gap-2.5 rounded-2xl bg-black/[0.03] px-3 py-2.5 transition hover:bg-accent/10 dark:bg-white/[0.04]">
                <button
                  type="button"
                  onClick={() => onToggleTodo?.(tk)}
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-300 transition hover:border-accent dark:border-racing-600"
                  aria-label={t('readiness.completeTodo')}
                />
                <button
                  type="button"
                  onClick={() => onOpenTodo?.(tk)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="block truncate text-sm font-medium leading-snug">{tk.title}</span>
                    <LifeAreaBadge area={area} />
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400">
                    {tk.startTime && (
                      <span className="font-semibold tabular-nums text-accent">{tk.startTime}</span>
                    )}
                    {overdue && (
                      <span className="font-semibold text-red-500">{t('readiness.next.overdueTag')}</span>
                    )}
                    {tk.urgent && tk.important && (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">Q1</span>
                    )}
                  </span>
                </button>
                <TaskTimer taskId={tk.id} boardId={tk.boardId} title={tk.title} compact />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function formatEventDuration(minutes: number, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (minutes < 60) return t('focus.durationMinutes', { count: minutes })
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (m === 0) return t('focus.durationHours', { count: h })
  return t('focus.durationHoursMinutes', { hours: h, minutes: m })
}

function formatBreakElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

function MetricTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="rounded-[18px] bg-gradient-to-br from-accent/[0.07] via-transparent to-transparent p-4 dark:from-accent/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {icon}
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {detail && <p className="mt-0.5 text-xs text-gray-500 dark:text-racing-300">{detail}</p>}
        </div>
      </div>
    </div>
  )
}

function DelightEmpty() {
  const { t } = useTranslation('dashboard')
  return (
    <div className="readiness-delight flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-accent/5 px-4 py-6 text-center">
      <CheckCircle2 size={28} className="text-emerald-500 readiness-pop" />
      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{t('readiness.todayTodosEmpty')}</p>
      <p className="text-xs text-gray-500 dark:text-racing-300">{t('readiness.todayTodosEmptyHint')}</p>
    </div>
  )
}
