import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isToday,
  max as maxDate,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, GripHorizontal, Lock } from 'lucide-react'
import type { Board, BoardColumn, Task } from '../../types'
import { AvatarStack } from '../dashboard/FocusVisuals'
import { toISODate } from '../../utils/date'

type ViewMode = 'project' | 'week' | 'month'

interface Props {
  board: Board
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
  /** Dashboard embed: no outer card, compact chrome */
  embedded?: boolean
}

function cardClass(extra = '') {
  return `rounded-2xl border border-gray-100/80 bg-white p-4 shadow-apple-sm dark:border-racing-800 dark:bg-racing-900 ${extra}`
}

function parseBoardDate(iso?: string): Date | null {
  if (!iso) return null
  const d = parseISO(iso.slice(0, 10))
  return isNaN(d.getTime()) ? null : startOfDay(d)
}

export function getProjectSpan(board: Board, tasks: Task[]): { start: Date; end: Date } {
  const start = parseBoardDate(board.createdAt) ?? startOfDay(new Date())
  const deadlineCandidates = [board.deadline, board.externalLaunch, board.internalLaunch]
    .map(parseBoardDate)
    .filter((d): d is Date => d !== null)

  let end: Date
  if (deadlineCandidates.length > 0) {
    end = maxDate(deadlineCandidates)
  } else {
    const taskDueDates = tasks
      .map((t) => parseBoardDate(t.dueDate))
      .filter((d): d is Date => d !== null)
    end = taskDueDates.length > 0 ? maxDate(taskDueDates) : addMonths(start, 3)
  }

  if (end < start) end = addMonths(start, 1)
  // Pad one day on each side for breathing room
  return { start: addDays(start, -1), end: addDays(end, 1) }
}

function taskBarRange(task: Task): { start: Date; end: Date } | null {
  if (!task.dueDate) return null
  const end = startOfDay(parseISO(task.dueDate))
  let start = end
  if (task.createdAt) {
    const created = startOfDay(parseISO(task.createdAt.slice(0, 10)))
    if (!isNaN(created.getTime()) && created <= end) start = created
  }
  return { start, end }
}

function taskProgress(task: Task, columns: BoardColumn[]): number {
  if (task.completed) return 100
  if (!task.columnId || columns.length === 0) return 10
  const idx = columns.findIndex((c) => c.id === task.columnId)
  if (idx < 0) return 10
  return Math.max(10, Math.round(((idx + 1) / columns.length) * 100))
}

function taskStatusLabel(task: Task, columns: BoardColumn[], t: (k: string) => string): string {
  if (task.completed) return t('projectDashboard.statusDone')
  const pct = taskProgress(task, columns)
  if (pct >= 80) return `${t('projectDashboard.statusInProgress')} ${pct}%`
  if (pct >= 40) return `${t('projectDashboard.statusInProgress')} ${pct}%`
  return `${t('projectDashboard.statusPending')} ${pct}%`
}

function taskAssignees(task: Task): { id: string; name: string; color: string }[] {
  if (task.assignee) {
    return [{ id: task.assignee.id, name: task.assignee.display_name, color: task.assignee.avatar_color }]
  }
  return []
}

function isTaskBlocked(task: Task, all: Task[]): boolean {
  if (task.completed || !task.dependsOn?.length) return false
  return task.dependsOn.some((depId) => {
    const dep = all.find((t) => t.id === depId)
    return dep ? !dep.completed : false
  })
}

const DAY_W = 44
const TASK_COL_W = 160

export default function ProjectTimeline({
  board,
  tasks,
  onTaskClick,
  onUpdateTask,
  embedded = false,
}: Props) {
  const { t, i18n } = useTranslation('boards')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const scrollRef = useRef<HTMLDivElement>(null)

  const projectSpan = useMemo(() => getProjectSpan(board, tasks), [board, tasks])

  const [viewMode, setViewMode] = useState<ViewMode>('project')
  const [anchor, setAnchor] = useState(new Date())
  const [dragging, setDragging] = useState<{
    taskId: string
    startX: number
    origStart: Date
    origEnd: Date
  } | null>(null)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)

  const viewRange = useMemo(() => {
    if (viewMode === 'project') {
      return {
        start: projectSpan.start,
        end: projectSpan.end,
        days: eachDayOfInterval({ start: projectSpan.start, end: projectSpan.end }),
      }
    }
    if (viewMode === 'week') {
      const start = startOfWeek(anchor, { weekStartsOn: 1 })
      const end = endOfWeek(anchor, { weekStartsOn: 1 })
      return { start, end, days: eachDayOfInterval({ start, end }) }
    }
    const start = startOfMonth(anchor)
    const end = endOfMonth(anchor)
    return { start, end, days: eachDayOfInterval({ start, end }) }
  }, [viewMode, anchor, projectSpan])

  const datedTasks = useMemo(
    () => tasks.filter((tk) => tk.dueDate).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [tasks]
  )
  const undatedTasks = useMemo(() => tasks.filter((tk) => !tk.dueDate && !tk.completed), [tasks])

  const totalDays = viewRange.days.length
  const gridWidth = totalDays * DAY_W

  const todayOffset = useMemo(() => {
    const today = startOfDay(new Date())
    const offset = differenceInCalendarDays(today, viewRange.start)
    if (offset < 0 || offset >= totalDays) return null
    return offset
  }, [viewRange.start, totalDays])

  const getBarStyle = useCallback(
    (task: Task) => {
      const range = taskBarRange(task)
      if (!range) return null
      const startOffset = differenceInCalendarDays(range.start, viewRange.start)
      const endOffset = differenceInCalendarDays(range.end, viewRange.start)
      if (endOffset < 0 || startOffset >= totalDays) return null
      const clampedStart = Math.max(0, startOffset)
      const clampedEnd = Math.min(totalDays - 1, endOffset)
      const left = (clampedStart / totalDays) * 100
      const width = ((clampedEnd - clampedStart + 1) / totalDays) * 100
      return { left: `${left}%`, width: `${Math.max(width, 100 / totalDays)}%` }
    },
    [viewRange.start, totalDays]
  )

  // Scroll to today on mount in project view
  useEffect(() => {
    if (viewMode !== 'project' || !scrollRef.current || todayOffset === null) return
    const scrollLeft = Math.max(0, todayOffset * DAY_W - scrollRef.current.clientWidth / 2)
    scrollRef.current.scrollLeft = scrollLeft
  }, [viewMode, todayOffset])

  const handlePointerDown = (e: React.PointerEvent, task: Task) => {
    const range = taskBarRange(task)
    if (!range || !task.dueDate) return
    e.preventDefault()
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDragging({ taskId: task.id, startX: e.clientX, origStart: range.start, origEnd: range.end })
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => e.preventDefault()
    const onUp = async (e: PointerEvent) => {
      const deltaX = e.clientX - dragging.startX
      const dayDelta = Math.round(deltaX / DAY_W)
      if (dayDelta !== 0) {
        const newEnd = addDays(dragging.origEnd, dayDelta)
        await onUpdateTask(dragging.taskId, { dueDate: toISODate(newEnd) })
      }
      setDragging(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging, onUpdateTask])

  const handleDropOnDay = async (taskId: string, day: Date) => {
    await onUpdateTask(taskId, { dueDate: toISODate(day) })
  }

  const headerLabel =
    viewMode === 'project'
      ? `${format(projectSpan.start, 'd. MMM yyyy', { locale: dateLocale })} – ${format(projectSpan.end, 'd. MMM yyyy', { locale: dateLocale })}`
      : viewMode === 'week'
        ? `${format(viewRange.start, 'd. MMM', { locale: dateLocale })} – ${format(viewRange.end, 'd. MMM yyyy', { locale: dateLocale })}`
        : format(anchor, 'MMMM yyyy', { locale: dateLocale })

  const navPrev = () => {
    if (viewMode === 'week') setAnchor(subWeeks(anchor, 1))
    else if (viewMode === 'month') setAnchor(subMonths(anchor, 1))
    else setAnchor(subMonths(anchor, 1))
  }

  const navNext = () => {
    if (viewMode === 'week') setAnchor(addWeeks(anchor, 1))
    else if (viewMode === 'month') setAnchor(addMonths(anchor, 1))
    else setAnchor(addMonths(anchor, 1))
  }

  const goToday = () => {
    setAnchor(new Date())
    if (viewMode === 'project' && scrollRef.current && todayOffset !== null) {
      scrollRef.current.scrollLeft = Math.max(0, todayOffset * DAY_W - scrollRef.current.clientWidth / 2)
    }
  }

  const ganttContent = (
    <>
      <div className={`mb-3 flex flex-wrap items-center justify-between gap-3 ${embedded ? '' : 'mb-4'}`}>
        <div className="flex items-center gap-2">
          {viewMode !== 'project' && (
            <button
              onClick={navPrev}
              className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <h2 className={`min-w-[180px] text-center font-semibold capitalize ${embedded ? 'text-xs' : 'text-sm'}`}>
            {headerLabel}
          </h2>
          {viewMode !== 'project' && (
            <button
              onClick={navNext}
              className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
            >
              <ChevronRight size={16} />
            </button>
          )}
          <button
            onClick={goToday}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            {t('timeline.today')}
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-racing-700">
          {(['project', 'week', 'month'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewMode === mode
                  ? 'bg-accent text-white'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
              }`}
            >
              {t(`timeline.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      {datedTasks.length === 0 ? (
        <div className={`flex flex-col items-center justify-center text-center ${embedded ? 'py-6' : 'py-12'}`}>
          <Calendar size={embedded ? 24 : 32} className="mb-3 text-gray-300 dark:text-racing-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-racing-200">{t('timeline.emptyTitle')}</p>
          <p className="mt-1 max-w-sm text-xs text-gray-400">{t('timeline.emptyHint')}</p>
        </div>
      ) : (
        <div ref={scrollRef} className="overflow-x-auto">
          <div style={{ minWidth: gridWidth + TASK_COL_W }}>
            {/* Day header */}
            <div className="flex border-b border-gray-100 dark:border-racing-800">
              <div
                style={{ width: TASK_COL_W }}
                className="flex-shrink-0 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400"
              >
                {t('timeline.taskColumn')}
              </div>
              <div className="relative flex flex-1" style={{ width: gridWidth }}>
                {todayOffset !== null && (
                  <div
                    className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-accent"
                    style={{ left: `${((todayOffset + 0.5) / totalDays) * 100}%` }}
                  >
                    <div className="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent" />
                  </div>
                )}
                {viewRange.days.map((day) => (
                  <div
                    key={day.toISOString()}
                    style={{ width: DAY_W }}
                    className={`flex-shrink-0 border-l border-dashed border-gray-200 pb-2 text-center dark:border-racing-700 ${
                      isToday(day) ? 'bg-accent/5' : ''
                    }`}
                  >
                    <p className="text-[9px] uppercase text-gray-400">
                      {format(day, 'EEE', { locale: dateLocale })}
                    </p>
                    <p
                      className={`text-xs font-medium ${
                        isToday(day) ? 'text-accent' : 'text-gray-600 dark:text-racing-200'
                      }`}
                    >
                      {format(day, 'd')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Task rows */}
            {datedTasks.map((task) => {
              const barStyle = getBarStyle(task)
              const isDragging = dragging?.taskId === task.id
              const assignees = taskAssignees(task)
              const statusLabel = taskStatusLabel(task, board.columns, t)
              const blocked = isTaskBlocked(task, tasks)
              const overdue =
                task.dueDate &&
                !task.completed &&
                parseISO(task.dueDate) < new Date() &&
                !isToday(parseISO(task.dueDate))

              return (
                <div key={task.id} className="group flex items-stretch border-b border-gray-50 dark:border-racing-800/50">
                  <button
                    type="button"
                    onClick={() => onTaskClick(task)}
                    style={{ width: TASK_COL_W }}
                    className="flex flex-shrink-0 items-center gap-1 truncate px-2 py-2.5 text-left text-xs font-medium hover:text-accent"
                  >
                    {blocked && <Lock size={10} className="flex-shrink-0 text-amber-500" />}
                    <span className="truncate">{task.title}</span>
                  </button>
                  <div className="relative flex-shrink-0" style={{ width: gridWidth, height: 52 }}>
                    {/* Dashed grid lines */}
                    <div className="absolute inset-0 flex">
                      {viewRange.days.map((day) => (
                        <div
                          key={day.toISOString()}
                          style={{ width: DAY_W }}
                          className={`flex-shrink-0 border-l border-dashed border-gray-100 dark:border-racing-800/60 ${
                            isToday(day) ? 'bg-accent/[0.03]' : ''
                          }`}
                        />
                      ))}
                    </div>
                    {/* Today line through rows */}
                    {todayOffset !== null && (
                      <div
                        className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-accent/60"
                        style={{ left: `${((todayOffset + 0.5) / totalDays) * 100}%` }}
                      />
                    )}
                    {/* Thin connector from first incomplete predecessor (same board span) */}
                    {blocked &&
                      barStyle &&
                      (task.dependsOn ?? []).slice(0, 1).map((depId) => {
                        const dep = datedTasks.find((tk) => tk.id === depId)
                        const depBar = dep ? getBarStyle(dep) : null
                        if (!depBar || !barStyle.left) return null
                        const depRight =
                          typeof depBar.left === 'string' && typeof depBar.width === 'string'
                            ? parseFloat(depBar.left) + parseFloat(depBar.width)
                            : null
                        const taskLeft = typeof barStyle.left === 'string' ? parseFloat(barStyle.left) : null
                        if (depRight === null || taskLeft === null || taskLeft <= depRight) return null
                        return (
                          <div
                            key={`link-${depId}`}
                            className="pointer-events-none absolute top-1/2 z-[5] h-px -translate-y-1/2 bg-amber-400/70"
                            style={{
                              left: `${depRight}%`,
                              width: `${taskLeft - depRight}%`,
                            }}
                          />
                        )
                      })}
                    {/* Bar pill */}
                    {barStyle && (
                      <div
                        className={`absolute top-2 flex h-9 cursor-grab items-center gap-1.5 rounded-xl border bg-white px-2.5 text-[10px] font-medium shadow-apple-sm transition-shadow active:cursor-grabbing dark:bg-racing-800 ${
                          blocked
                            ? 'border-amber-300/80 dark:border-amber-500/40'
                            : 'border-gray-100/80 dark:border-racing-700'
                        } ${task.completed ? 'opacity-60' : ''} ${overdue ? 'ring-1 ring-red-400/50' : ''} ${
                          isDragging ? 'z-30 -rotate-2 scale-[1.02] shadow-apple-lg' : 'hover:shadow-apple-md'
                        }`}
                        style={{
                          ...barStyle,
                          minWidth: DAY_W - 4,
                        }}
                        onPointerDown={(e) => handlePointerDown(e, task)}
                        onClick={(e) => {
                          e.stopPropagation()
                          onTaskClick(task)
                        }}
                      >
                        <GripHorizontal size={10} className="flex-shrink-0 text-gray-300" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-semibold text-gray-800 dark:text-racing-50">
                            {task.title}
                          </p>
                          <p className="truncate text-[9px] text-gray-400">
                            {blocked ? t('timeline.blocked') : statusLabel}
                          </p>
                        </div>
                        {blocked && (
                          <span className="flex flex-shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                            <Lock size={8} />
                            {t('timeline.blockedBadge')}
                          </span>
                        )}
                        {assignees.length > 0 && (
                          <div className="flex-shrink-0 scale-75">
                            <AvatarStack people={assignees} max={2} />
                          </div>
                        )}
                        <div
                          className="absolute bottom-0 left-0 h-0.5 rounded-b-xl"
                          style={{
                            width: `${taskProgress(task, board.columns)}%`,
                            backgroundColor: task.completed ? '#9CA3AF' : blocked ? '#F59E0B' : board.color,
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!embedded && <p className="mt-3 text-[10px] text-gray-400">{t('timeline.dragHint')}</p>}
    </>
  )

  const undatedSection =
    undatedTasks.length > 0 && !embedded ? (
      <div className={cardClass()}>
        <h3 className="mb-3 text-sm font-semibold">{t('timeline.undatedTitle')}</h3>
        <p className="mb-3 text-xs text-gray-400">{t('timeline.undatedHint')}</p>
        <div className="flex flex-wrap gap-2">
          {undatedTasks.map((task) => (
            <button
              key={task.id}
              type="button"
              draggable
              onDragStart={() => setDragTaskId(task.id)}
              onDragEnd={() => setDragTaskId(null)}
              onClick={() => onTaskClick(task)}
              className="cursor-grab rounded-xl border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-medium hover:border-accent/30 hover:bg-accent/5 active:cursor-grabbing dark:border-racing-700 dark:bg-racing-800 dark:hover:border-accent/30"
            >
              {task.title}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {t('timeline.dropToSchedule')}
          </p>
          <div className="flex gap-1" style={{ minWidth: gridWidth }}>
            {viewRange.days.map((day) => (
              <div
                key={day.toISOString()}
                style={{ width: DAY_W }}
                className={`flex h-8 flex-shrink-0 items-center justify-center rounded-md border border-dashed text-[9px] transition-colors dark:border-racing-700 ${
                  dragTaskId
                    ? 'border-accent/30 text-gray-400 hover:border-accent hover:bg-accent/10 hover:text-accent'
                    : 'border-gray-200 text-gray-300'
                } ${isToday(day) ? 'border-accent/20' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragTaskId) {
                    handleDropOnDay(dragTaskId, day)
                    setDragTaskId(null)
                  }
                }}
                title={format(day, 'd. MMM', { locale: dateLocale })}
              >
                {format(day, 'd')}
              </div>
            ))}
          </div>
        </div>
      </div>
    ) : null

  if (embedded) {
    return <div>{ganttContent}</div>
  }

  return (
    <div className="space-y-4">
      <div className={cardClass()}>{ganttContent}</div>
      {undatedSection}
    </div>
  )
}
