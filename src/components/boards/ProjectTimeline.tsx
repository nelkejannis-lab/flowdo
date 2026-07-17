import { useCallback, useEffect, useMemo, useState } from 'react'
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
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, GripHorizontal } from 'lucide-react'
import type { Board, Task } from '../../types'
import { toISODate } from '../../utils/date'

type ViewMode = 'week' | 'month'

interface Props {
  board: Board
  tasks: Task[]
  onTaskClick: (task: Task) => void
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
}

function cardClass(extra = '') {
  return `rounded-2xl border border-gray-100/80 bg-white p-4 shadow-apple-sm dark:border-racing-800 dark:bg-racing-900 ${extra}`
}

function taskBarRange(task: Task): { start: Date; end: Date } | null {
  if (!task.dueDate) return null
  const end = parseISO(task.dueDate)
  let start = end
  if (task.createdAt) {
    const created = parseISO(task.createdAt.slice(0, 10))
    if (!isNaN(created.getTime()) && created <= end) start = created
  }
  return { start, end }
}

const DAY_W = 44

export default function ProjectTimeline({ board, tasks, onTaskClick, onUpdateTask }: Props) {
  const { t, i18n } = useTranslation('boards')
  const dateLocale = i18n.language === 'en' ? enUS : de

  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(new Date())
  const [dragging, setDragging] = useState<{ taskId: string; startX: number; origDue: string } | null>(null)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)

  const viewRange = useMemo(() => {
    if (viewMode === 'week') {
      const start = startOfWeek(anchor, { weekStartsOn: 1 })
      const end = endOfWeek(anchor, { weekStartsOn: 1 })
      return { start, end, days: eachDayOfInterval({ start, end }) }
    }
    const start = startOfMonth(anchor)
    const end = endOfMonth(anchor)
    return { start, end, days: eachDayOfInterval({ start, end }) }
  }, [viewMode, anchor])

  const datedTasks = useMemo(
    () => tasks.filter((tk) => tk.dueDate).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [tasks]
  )
  const undatedTasks = useMemo(() => tasks.filter((tk) => !tk.dueDate && !tk.completed), [tasks])

  const totalDays = viewRange.days.length
  const gridWidth = totalDays * DAY_W

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

  const handlePointerDown = (e: React.PointerEvent, task: Task) => {
    if (!task.dueDate) return
    e.preventDefault()
    e.stopPropagation()
    setDragging({ taskId: task.id, startX: e.clientX, origDue: task.dueDate })
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => e.preventDefault()
    const onUp = async (e: PointerEvent) => {
      const deltaX = e.clientX - dragging.startX
      const dayDelta = Math.round(deltaX / DAY_W)
      if (dayDelta !== 0) {
        const newDue = toISODate(addDays(parseISO(dragging.origDue), dayDelta))
        await onUpdateTask(dragging.taskId, { dueDate: newDue })
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
    viewMode === 'week'
      ? `${format(viewRange.start, 'd. MMM', { locale: dateLocale })} – ${format(viewRange.end, 'd. MMM yyyy', { locale: dateLocale })}`
      : format(anchor, 'MMMM yyyy', { locale: dateLocale })

  return (
    <div className="space-y-4">
      <div className={cardClass()}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnchor(viewMode === 'week' ? subWeeks(anchor, 1) : subMonths(anchor, 1))}
              className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="min-w-[180px] text-center text-sm font-semibold capitalize">{headerLabel}</h2>
            <button
              onClick={() => setAnchor(viewMode === 'week' ? addWeeks(anchor, 1) : addMonths(anchor, 1))}
              className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
            >
              {t('timeline.today')}
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-racing-700">
            {(['week', 'month'] as ViewMode[]).map((mode) => (
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar size={32} className="mb-3 text-gray-300 dark:text-racing-600" />
            <p className="text-sm font-medium text-gray-500 dark:text-racing-200">{t('timeline.emptyTitle')}</p>
            <p className="mt-1 max-w-sm text-xs text-gray-400">{t('timeline.emptyHint')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: gridWidth + 160 }}>
              {/* Day header */}
              <div className="flex border-b border-gray-100 dark:border-racing-800">
                <div className="w-40 flex-shrink-0 px-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  {t('timeline.taskColumn')}
                </div>
                <div className="flex flex-1" style={{ width: gridWidth }}>
                  {viewRange.days.map((day) => (
                    <div
                      key={day.toISOString()}
                      style={{ width: DAY_W }}
                      className={`flex-shrink-0 border-l border-gray-50 pb-2 text-center dark:border-racing-800 ${
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
                const overdue = task.dueDate && !task.completed && parseISO(task.dueDate) < new Date() && !isToday(parseISO(task.dueDate))
                return (
                  <div
                    key={task.id}
                    className="group flex items-center border-b border-gray-50 dark:border-racing-800/50"
                  >
                    <button
                      type="button"
                      onClick={() => onTaskClick(task)}
                      className="w-40 flex-shrink-0 truncate px-2 py-2.5 text-left text-xs font-medium hover:text-accent"
                    >
                      {task.title}
                    </button>
                    <div
                      className="relative flex-shrink-0"
                      style={{ width: gridWidth, height: 36 }}
                    >
                      {/* Grid lines */}
                      <div className="absolute inset-0 flex">
                        {viewRange.days.map((day) => (
                          <div
                            key={day.toISOString()}
                            style={{ width: DAY_W }}
                            className={`flex-shrink-0 border-l border-gray-50 dark:border-racing-800/50 ${
                              isToday(day) ? 'bg-accent/[0.03]' : ''
                            }`}
                          />
                        ))}
                      </div>
                      {/* Bar */}
                      {barStyle && (
                        <div
                          className={`absolute top-1.5 flex h-7 cursor-grab items-center gap-1 rounded-lg px-2 text-[10px] font-medium text-white shadow-sm active:cursor-grabbing ${
                            task.completed ? 'opacity-50' : ''
                          } ${overdue ? 'ring-1 ring-red-400/50' : ''}`}
                          style={{
                            ...barStyle,
                            backgroundColor: task.completed ? '#9CA3AF' : board.color,
                            minWidth: DAY_W - 4,
                          }}
                          onPointerDown={(e) => handlePointerDown(e, task)}
                          onClick={(e) => {
                            e.stopPropagation()
                            onTaskClick(task)
                          }}
                        >
                          <GripHorizontal size={10} className="flex-shrink-0 opacity-60" />
                          <span className="truncate">{task.title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <p className="mt-3 text-[10px] text-gray-400">{t('timeline.dragHint')}</p>
      </div>

      {undatedTasks.length > 0 && (
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
      )}
    </div>
  )
}
