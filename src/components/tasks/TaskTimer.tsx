import { useEffect, useState, type MouseEvent, type PointerEvent } from 'react'
import { Clock, Pause, Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTaskTimerStore } from '../../store/taskTimerStore'
import { useTaskTimeStore } from '../../store/taskTimeStore'
import { formatHM } from '../../utils/worktime'
import TaskManualTimeLog from './TaskManualTimeLog'

interface TaskTimerProps {
  taskId: string
  boardId?: string | null
  title: string
  /** Icon-only controls for dense rows (Kanban, Eisenhower, dashboard). */
  compact?: boolean
  className?: string
}

function formatLive(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TaskTimer({
  taskId,
  boardId = null,
  title,
  compact = false,
  className = '',
}: TaskTimerProps) {
  const { t } = useTranslation('tasks')
  const runningTaskId = useTaskTimerStore((s) => s.taskId)
  const timerRunning = useTaskTimerStore((s) => s.running)
  const startTimer = useTaskTimerStore((s) => s.start)
  const pauseTimer = useTaskTimerStore((s) => s.pause)
  const resumeTimer = useTaskTimerStore((s) => s.resume)
  const stopTimer = useTaskTimerStore((s) => s.stop)
  const getElapsedSeconds = useTaskTimerStore((s) => s.getElapsedSeconds)
  const loggedMinutes = useTaskTimeStore((s) => s.getTaskMinutes(taskId))
  const [, tick] = useState(0)

  const isActive = runningTaskId === taskId
  const isRunning = isActive && timerRunning

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const liveSeconds = isActive ? getElapsedSeconds() : 0
  const badgeMinutes = loggedMinutes + (isActive ? Math.floor(liveSeconds / 60) : 0)

  async function handleToggle(e: MouseEvent | PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!isActive) {
      await startTimer(taskId, boardId ?? null, title)
      return
    }
    if (timerRunning) pauseTimer()
    else resumeTimer()
  }

  async function handleStop(e: MouseEvent | PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (!isActive) return
    await stopTimer()
  }

  const toggleLabel = !isActive
    ? t('item.track')
    : timerRunning
      ? t('item.pauseTimer')
      : t('item.resumeTimer')

  if (compact) {
    return (
      <span
        className={`inline-flex flex-shrink-0 items-center gap-0.5 ${className}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {badgeMinutes > 0 && (
          <span
            className="mr-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            title={t('item.tracked', { time: formatHM(loggedMinutes || badgeMinutes) })}
          >
            {isActive ? formatLive(liveSeconds) : formatHM(loggedMinutes)}
          </span>
        )}
        {isActive && badgeMinutes === 0 && (
          <span className="mr-0.5 font-mono text-[10px] font-semibold tabular-nums text-emerald-600">
            {formatLive(liveSeconds)}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => void handleToggle(e)}
          className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
            isActive
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-racing-800 dark:hover:bg-emerald-900/40'
          }`}
          title={toggleLabel}
          aria-label={toggleLabel}
        >
          {isRunning ? <Pause size={10} /> : isActive ? <Play size={10} /> : <Clock size={10} />}
        </button>
        {isActive && (
          <button
            type="button"
            onClick={(e) => void handleStop(e)}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/30"
            title={t('item.stopTimer')}
            aria-label={t('item.stopTimer')}
          >
            <Square size={9} />
          </button>
        )}
      </span>
    )
  }

  return (
    <div
      className={className}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-2">
        {(loggedMinutes > 0 || isActive) && (
          <span
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 font-mono text-xs font-semibold tabular-nums text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            title={t('item.tracked', { time: formatHM(loggedMinutes) })}
          >
            <Clock size={12} />
            {isActive ? formatLive(liveSeconds) : formatHM(loggedMinutes)}
            {!isActive && loggedMinutes > 0 && (
              <span className="font-sans text-[10px] font-medium opacity-70">{t('item.trackedShort')}</span>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => void handleToggle(e)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
            isActive
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300'
          }`}
          title={toggleLabel}
        >
          {isRunning ? <Pause size={12} /> : <Play size={12} />}
          {toggleLabel}
        </button>
        {isActive && (
          <button
            type="button"
            onClick={(e) => void handleStop(e)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300"
            title={t('item.stopTimer')}
          >
            <Square size={11} />
            {t('item.stopTimer')}
          </button>
        )}
      </div>
      <TaskManualTimeLog taskId={taskId} boardId={boardId} />
    </div>
  )
}
