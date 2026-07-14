import { useEffect, useState } from 'react'
import { Clock, Pause, Play, Square } from 'lucide-react'
import { useTaskTimerStore } from '../../store/taskTimerStore'
import { formatHM } from '../../utils/worktime'

export default function TaskTimerBar() {
  const running = useTaskTimerStore((s) => s.running)
  const taskTitle = useTaskTimerStore((s) => s.taskTitle)
  const taskId = useTaskTimerStore((s) => s.taskId)
  const pause = useTaskTimerStore((s) => s.pause)
  const resume = useTaskTimerStore((s) => s.resume)
  const stop = useTaskTimerStore((s) => s.stop)
  const getElapsedSeconds = useTaskTimerStore((s) => s.getElapsedSeconds)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  if (!taskId || !taskTitle) return null

  const seconds = getElapsedSeconds()
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 shadow-lg dark:border-emerald-900 dark:bg-racing-900">
      <Clock size={16} className="text-emerald-600" />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold">{taskTitle}</p>
        <p className="font-mono text-sm font-bold text-emerald-600">{display}</p>
      </div>
      <button
        type="button"
        onClick={() => (running ? pause() : resume())}
        className="rounded-lg bg-emerald-100 p-2 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40"
      >
        {running ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        type="button"
        onClick={() => void stop()}
        className="rounded-lg bg-red-100 p-2 text-red-600 hover:bg-red-200 dark:bg-red-900/40"
        title={`Stoppen (${formatHM(Math.max(1, Math.round(seconds / 60)))})`}
      >
        <Square size={14} />
      </button>
    </div>
  )
}
