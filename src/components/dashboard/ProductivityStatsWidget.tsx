import { useEffect, useState } from 'react'
import { CheckSquare, Clock, Flame, TrendingUp } from 'lucide-react'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { todayISO, isDueToday, isOverdue, isCompletedToday } from '../../utils/date'
import { formatHM, netMinutes } from '../../utils/worktime'

export default function ProductivityStatsWidget() {
  const tasks = useTasksStore((s) => s.tasks)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const isRunning = useWorkTimeStore((s) => s.isRunning)
  const runningStartedAt = useWorkTimeStore((s) => s.runningStartedAt)
  const entries = useWorkTimeStore((s) => s.entries)

  const [, tick] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [isRunning])

  const today = todayISO()
  const allTasks = [...tasks, ...myProjectTasks]
  const completedToday = allTasks.filter((t) => t.completed && isCompletedToday(t.completedAt)).length
  const pendingToday = allTasks.filter((t) => !t.completed && (isDueToday(t.dueDate) || isOverdue(t.dueDate))).length
  const totalToday = completedToday + pendingToday
  const taskProgress = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0

  // Worked hours
  const entry = entries[today]
  const liveMinutes = isRunning && runningStartedAt
    ? (Date.now() - new Date(runningStartedAt).getTime()) / 60000
    : 0
  const workedMinutes = netMinutes(entry) + liveMinutes

  // Pomodoro sessions
  const pomodoroSessions = (() => {
    try {
      return parseInt(localStorage.getItem(`pomodoro_sessions_${today}`) ?? '0', 10)
    } catch {
      return 0
    }
  })()
  const focusMinutes = pomodoroSessions * 25

  const circumference = 2 * Math.PI * 26
  const dashOffset = circumference * (1 - (totalToday > 0 ? taskProgress : 100) / 100)

  return (
    <div className="group flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 hover:border-accent/30 hover:shadow-sm transition-all dark:border-racing-800 dark:bg-racing-900">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <TrendingUp size={12} className="text-emerald-500" /> Produktivität heute
        </span>
        {taskProgress === 100 && completedToday > 0 && (
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
            Alles erledigt!
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Ring progress for task completion */}
        <div className="relative flex-shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="5" />
            <circle
              cx="32" cy="32" r="26"
              fill="none"
              stroke={totalToday > 0 && taskProgress === 100 ? '#10b981' : '#6366f1'}
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-xs font-bold tabular-nums">
              {totalToday > 0 ? `${taskProgress}%` : '0%'}
            </span>
            <span className="text-[8px] text-gray-400 mt-0.5">Aufgaben</span>
          </div>
        </div>

        {/* Quick stats list */}
        <div className="flex flex-1 flex-col gap-2">
          {/* Tasks */}
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-500">
              <CheckSquare size={13} className="text-indigo-500" /> Aufgaben:
            </span>
            <span className="font-semibold tabular-nums text-gray-800 dark:text-racing-100">
              {completedToday} / {totalToday}
            </span>
          </div>

          {/* Pomodoro Focus Sessions */}
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-500">
              <Flame size={13} className="text-orange-500" /> Fokuszeit:
            </span>
            <span className="font-semibold tabular-nums text-gray-800 dark:text-racing-100">
              {focusMinutes > 0 ? `${focusMinutes} Min` : '0 Min'}
            </span>
          </div>

          {/* Work Hours */}
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-500">
              <Clock size={13} className="text-emerald-500" /> Arbeitszeit:
            </span>
            <span className="font-semibold tabular-nums text-gray-800 dark:text-racing-100">
              {formatHM(workedMinutes)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
