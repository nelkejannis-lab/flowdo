import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock, Plus, TrendingUp } from 'lucide-react'
import type { Board, Task } from '../../types'
import { useTaskTimeStore } from '../../store/taskTimeStore'
import { useAuthStore } from '../../store/authStore'
import { todayISO } from '../../utils/date'
import { formatHM } from '../../utils/worktime'
import ProjectWorkload from './ProjectWorkload'
import BoardMilestones from './BoardMilestones'

interface Props {
  board: Board
  tasks: Task[]
}

function healthColor(pct: number, overdue: number): string {
  if (overdue > 0) return 'text-red-600 bg-red-50 dark:bg-red-900/30'
  if (pct >= 80) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
  if (pct >= 50) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30'
  return 'text-gray-600 bg-gray-50 dark:bg-racing-800'
}

export default function ProjectTimeReport({ board, tasks }: Props) {
  const { t } = useTranslation('boards')
  const userId = useAuthStore((s) => s.user?.id)
  const fetchByBoard = useTaskTimeStore((s) => s.fetchByBoard)
  const addEntry = useTaskTimeStore((s) => s.addEntry)
  const getBoardSummary = useTaskTimeStore((s) => s.getBoardSummary)
  const getEstimateComparison = useTaskTimeStore((s) => s.getEstimateComparison)
  const [minutes, setMinutes] = useState(30)
  const [taskId, setTaskId] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    void fetchByBoard(board.id)
  }, [board.id, fetchByBoard])

  const openTasks = tasks.filter((tk) => !tk.completed)
  const overdue = openTasks.filter((tk) => tk.dueDate && tk.dueDate < todayISO()).length
  const done = tasks.filter((tk) => tk.completed).length
  const progress = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)
  const summary = getBoardSummary(board.id, tasks.map((tk) => tk.id))
  const comparison = getEstimateComparison(tasks)
  const budget = board.timeBudgetMinutes
  const budgetPct = budget ? Math.round((summary.totalMinutes / budget) * 100) : null
  const healthClass = healthColor(progress, overdue)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!userId || minutes <= 0) return
    await addEntry({
      boardId: board.id,
      userId,
      minutes,
      date: todayISO(),
      taskId: taskId || undefined,
      note: note.trim() || undefined,
    })
    setNote('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-xl border p-4 ${healthClass} border-current/20`}>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          {overdue > 0 ? <AlertTriangle size={14} /> : <TrendingUp size={14} />}
          {t('health.title')}
        </div>
        <p className="text-xs opacity-80">
          {overdue > 0
            ? t('health.overdue', { count: overdue })
            : progress >= 80
              ? t('health.good')
              : t('health.progress', { percent: progress })}
          {budgetPct !== null && ` · ${t('health.budget', { percent: budgetPct })}`}
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 p-4 dark:border-racing-800">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Clock size={14} />
          {t('timeReport.title')}
        </h3>
        <div className="mb-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-racing-800">
            <p className="text-xs text-gray-400">{t('timeReport.totalTime')}</p>
            <p className="text-lg font-bold">{formatHM(summary.totalMinutes)}</p>
            {budget && <p className="text-[10px] text-gray-400">/ {formatHM(budget)}</p>}
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-racing-800">
            <p className="text-xs text-gray-400">{t('timeReport.progress')}</p>
            <p className="text-lg font-bold">{progress}%</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-racing-800">
            <p className="text-xs text-gray-400">{t('timeReport.openTasks')}</p>
            <p className="text-lg font-bold">{openTasks.length}</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 dark:bg-racing-800">
            <p className="text-xs text-gray-400">{t('timeReport.estimatedVsActual')}</p>
            <p className="text-sm font-bold">
              {comparison.estimated > 0
                ? `${formatHM(comparison.actual)} / ${formatHM(comparison.estimated)}`
                : formatHM(comparison.actual)}
            </p>
          </div>
        </div>
        <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs text-gray-400">{t('timeReport.minutes')}</label>
            <input type="number" min={1} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
              className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-racing-700" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="mb-1 block text-xs text-gray-400">{t('timeReport.task')}</label>
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-racing-700">
              <option value="">{t('timeReport.noTask')}</option>
              {openTasks.map((tk) => <option key={tk.id} value={tk.id}>{tk.title}</option>)}
            </select>
          </div>
          <button type="submit" className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
            <Plus size={12} /> {t('timeReport.log')}
          </button>
        </form>
        {Object.keys(summary.byTask).length > 0 && (
          <ul className="flex flex-col gap-1 text-xs text-gray-500">
            {Object.entries(summary.byTask).map(([id, mins]) => {
              const tk = tasks.find((t) => t.id === id)
              const est = tk?.estimatedMinutes
              return (
                <li key={id} className="flex justify-between gap-2">
                  <span className="truncate">{tk?.title ?? id}</span>
                  <span className="font-medium shrink-0">
                    {formatHM(mins)}
                    {est ? ` / ${formatHM(est)}` : ''}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <ProjectWorkload board={board} tasks={tasks} byTask={summary.byTask} />
      <BoardMilestones boardId={board.id} />
    </div>
  )
}
