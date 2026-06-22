import { useEffect, useRef, useState } from 'react'
import { Bell, BellOff, CheckSquare, Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/tasksStore'
import { todayISO } from '../utils/date'

type Phase = 'focus' | 'short' | 'long'

const DURATIONS: Record<Phase, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
}

const PHASE_COLORS: Record<Phase, string> = {
  focus: 'from-accent to-purple-600',
  short: 'from-emerald-500 to-teal-600',
  long: 'from-blue-500 to-cyan-600',
}

export default function PomodoroPage() {
  const { t } = useTranslation('pomodoro')
  const tasks = useTasksStore((s) => s.tasks)
  const fetchAll = useTasksStore((s) => s.fetchAll)

  const [phase, setPhase] = useState<Phase>('focus')
  const [timeLeft, setTimeLeft] = useState(DURATIONS.focus)
  const [running, setRunning] = useState(false)
  const today = todayISO()
  const [sessions, setSessions] = useState(() => {
    try {
      return parseInt(localStorage.getItem(`pomodoro_sessions_${today}`) ?? '0', 10)
    } catch {
      return 0
    }
  })
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [notifPerm, setNotifPerm] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'denied'
  )
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { fetchAll() }, [fetchAll])

  function switchPhase(p: Phase) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setPhase(p)
    setTimeLeft(DURATIONS[p])
    setRunning(false)
  }

  function reset() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setTimeLeft(DURATIONS[phase])
    setRunning(false)
  }

  function notify(title: string, body: string) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(title, { body }) } catch {}
    }
  }

  async function requestNotifications() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
  }

  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          setRunning(false)
          if (phase === 'focus') {
            setSessions((s) => {
              const next = s + 1
              localStorage.setItem(`pomodoro_sessions_${today}`, String(next))
              return next
            })
            notify(t('focusDone'), t('takeBreak'))
          } else {
            notify(t('breakDone'), t('backToWork'))
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, phase, today])

  const mins = Math.floor(timeLeft / 60).toString().padStart(2, '0')
  const secs = (timeLeft % 60).toString().padStart(2, '0')
  const progress = 1 - timeLeft / DURATIONS[phase]

  const pendingTasks = tasks.filter((tk) => !tk.completed)
  const activeTask = pendingTasks.find((tk) => tk.id === activeTaskId)

  const circumference = 2 * Math.PI * 90
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold flex items-center gap-2">
        <Timer size={24} className="text-accent" />
        {t('title')}
      </h1>

      {/* Phase tabs */}
      <div className="mb-6 flex items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-racing-700 dark:bg-racing-900">
        {(['focus', 'short', 'long'] as Phase[]).map((p) => (
          <button
            key={p}
            onClick={() => switchPhase(p)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
              phase === p
                ? 'bg-accent text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
            }`}
          >
            {t(`phases.${p}`)}
          </button>
        ))}
      </div>

      {/* Timer circle */}
      <div className={`mb-6 flex flex-col items-center gap-6 rounded-2xl bg-gradient-to-br ${PHASE_COLORS[phase]} p-8 text-white shadow-lg`}>
        {activeTask && (
          <div className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
            <CheckSquare size={14} />
            {activeTask.title}
          </div>
        )}

        <div className="relative flex items-center justify-center">
          <svg width="220" height="220" className="-rotate-90">
            <circle cx="110" cy="110" r="90" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
            <circle
              cx="110" cy="110" r="90"
              fill="none"
              stroke="white"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
          </svg>
          <div className="absolute text-center">
            <div className="text-6xl font-bold tabular-nums tracking-tight">{mins}:{secs}</div>
            <div className="mt-1 text-sm font-medium opacity-80">{t(`phases.${phase}`)}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRunning((r) => !r)}
            className="flex items-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-base font-semibold backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            {running ? <Pause size={18} /> : <Play size={18} />}
            {running ? t('pause') : t('start')}
          </button>
          <button
            onClick={reset}
            className="rounded-xl bg-white/20 p-3 backdrop-blur-sm hover:bg-white/30 transition-colors"
            title={t('reset')}
          >
            <RotateCcw size={18} />
          </button>
          <button
            onClick={notifPerm === 'granted' ? undefined : requestNotifications}
            className={`rounded-xl p-3 backdrop-blur-sm transition-colors ${
              notifPerm === 'granted' ? 'bg-white/30' : 'bg-white/20 hover:bg-white/30'
            }`}
            title={notifPerm === 'granted' ? t('notificationsOn') : t('enableNotifications')}
          >
            {notifPerm === 'granted' ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm opacity-80">
          <span>🍅 {sessions} {t('sessionsToday')}</span>
          <span>·</span>
          <span>⏱ {sessions * 25} {t('minutesFocused')}</span>
        </div>
      </div>

      {/* Task list */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          {t('tasks')}
        </h2>
        {pendingTasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{t('noTasks')}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {pendingTasks.slice(0, 20).map((task) => (
              <div
                key={task.id}
                onClick={() => setActiveTaskId(task.id === activeTaskId ? null : task.id)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors ${
                  task.id === activeTaskId
                    ? 'bg-accent/10 text-accent'
                    : 'hover:bg-gray-50 dark:hover:bg-racing-800'
                }`}
              >
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${
                    task.priority === 'high'
                      ? 'bg-red-400'
                      : task.priority === 'medium'
                      ? 'bg-amber-400'
                      : 'bg-gray-300'
                  }`}
                />
                <span className="flex-1 truncate text-sm">{task.title}</span>
                {task.dueDate && (
                  <span className="text-xs text-gray-400">{task.dueDate.slice(5)}</span>
                )}
                {task.id === activeTaskId && (
                  <CheckSquare size={14} className="flex-shrink-0 text-accent" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
