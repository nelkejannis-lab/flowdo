import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock, Pencil, Plus, Settings, Trash2, TrendingUp } from 'lucide-react'
import type { Board, Task } from '../../types'
import { useTaskTimeStore, type TaskTimeEntry } from '../../store/taskTimeStore'
import { useBoardPresetsStore } from '../../store/boardPresetsStore'
import { useAuthStore } from '../../store/authStore'
import { todayISO, formatFriendlyDate } from '../../utils/date'
import { formatHM } from '../../utils/worktime'
import ProjectWorkload from './ProjectWorkload'

interface Props {
  board: Board
  tasks: Task[]
  onOpenSettings?: () => void
}

const QUICK_MINUTES = [15, 30, 45, 60] as const

function healthColor(pct: number, overdue: number): string {
  if (overdue > 0) return 'text-red-600 bg-red-50 dark:bg-red-900/30'
  if (pct >= 80) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
  if (pct >= 50) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30'
  return 'text-gray-600 bg-gray-50 dark:bg-racing-800'
}

export default function ProjectTimeReport({ board, tasks, onOpenSettings }: Props) {
  const { t } = useTranslation('boards')
  const userId = useAuthStore((s) => s.user?.id)
  const entries = useTaskTimeStore((s) => s.entries.filter((e) => e.boardId === board.id))
  const fetchByBoard = useTaskTimeStore((s) => s.fetchByBoard)
  const addEntry = useTaskTimeStore((s) => s.addEntry)
  const updateEntry = useTaskTimeStore((s) => s.updateEntry)
  const deleteEntry = useTaskTimeStore((s) => s.deleteEntry)
  const getBoardSummary = useTaskTimeStore((s) => s.getBoardSummary)
  const getEstimateComparison = useTaskTimeStore((s) => s.getEstimateComparison)
  const getLogDefault = useBoardPresetsStore((s) => s.getLogDefault)

  const [minutes, setMinutes] = useState(getLogDefault(board.id))
  const [taskId, setTaskId] = useState('')
  const [note, setNote] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMinutes, setEditMinutes] = useState(0)
  const [editDate, setEditDate] = useState('')
  const [editTaskId, setEditTaskId] = useState('')
  const [editNote, setEditNote] = useState('')

  useEffect(() => {
    void fetchByBoard(board.id)
    setMinutes(getLogDefault(board.id))
  }, [board.id, fetchByBoard, getLogDefault])

  const openTasks = tasks.filter((tk) => !tk.completed)
  const allTaskOptions = tasks
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

  function startEdit(entry: TaskTimeEntry) {
    setEditingId(entry.id)
    setEditMinutes(entry.minutes)
    setEditDate(entry.date)
    setEditTaskId(entry.taskId ?? '')
    setEditNote(entry.note ?? '')
  }

  async function saveEdit() {
    if (!editingId || editMinutes <= 0) return
    await updateEntry(editingId, {
      minutes: editMinutes,
      date: editDate,
      taskId: editTaskId || undefined,
      note: editNote.trim() || undefined,
    })
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={`rounded-xl border p-4 ${healthClass} border-current/20`}>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {overdue > 0 ? <AlertTriangle size={14} /> : <TrendingUp size={14} />}
            {t('health.title')}
          </div>
          {onOpenSettings && (
            <button type="button" onClick={onOpenSettings} className="flex items-center gap-1 text-xs font-medium opacity-70 hover:opacity-100">
              <Settings size={12} /> {t('settings.open')}
            </button>
          )}
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

        <form onSubmit={handleAdd} className="mb-3 flex flex-wrap items-end gap-2">
          <div className="flex gap-1">
            {QUICK_MINUTES.map((m) => (
              <button key={m} type="button" onClick={() => setMinutes(m)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold ${minutes === m ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-racing-800'}`}>
                {m}
              </button>
            ))}
          </div>
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
              {allTaskOptions.map((tk) => <option key={tk.id} value={tk.id}>{tk.title}</option>)}
            </select>
          </div>
          <button type="submit" className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
            <Plus size={12} /> {t('timeReport.log')}
          </button>
        </form>

        {entries.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-400">{t('timeReport.entries')}</p>
            <ul className="flex flex-col gap-1">
              {entries.map((entry) => {
                const tk = entry.taskId ? tasks.find((t) => t.id === entry.taskId) : undefined
                if (editingId === entry.id) {
                  return (
                    <li key={entry.id} className="flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-2 dark:bg-racing-800">
                      <input type="number" min={1} value={editMinutes} onChange={(e) => setEditMinutes(Number(e.target.value))}
                        className="w-16 rounded border px-2 py-1 text-xs dark:border-racing-700" />
                      <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                        className="rounded border px-2 py-1 text-xs dark:border-racing-700" />
                      <select value={editTaskId} onChange={(e) => setEditTaskId(e.target.value)}
                        className="flex-1 min-w-[100px] rounded border px-2 py-1 text-xs dark:border-racing-700">
                        <option value="">{t('timeReport.noTask')}</option>
                        {allTaskOptions.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </select>
                      <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder={t('timeReport.note')}
                        className="flex-1 min-w-[80px] rounded border px-2 py-1 text-xs dark:border-racing-700" />
                      <button type="button" onClick={saveEdit} className="rounded bg-accent px-2 py-1 text-xs text-white">{t('timeReport.save')}</button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-xs text-gray-400">{t('timeReport.cancel')}</button>
                    </li>
                  )
                }
                return (
                  <li key={entry.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-racing-800">
                    <span className="w-14 font-mono font-semibold">{formatHM(entry.minutes)}</span>
                    <span className="w-20 text-gray-400">{formatFriendlyDate(entry.date)}</span>
                    <span className="min-w-0 flex-1 truncate">{tk?.title ?? t('timeReport.noTask')}</span>
                    {entry.note && <span className="truncate text-gray-400">{entry.note}</span>}
                    <button type="button" onClick={() => startEdit(entry)} className="text-gray-300 hover:text-accent"><Pencil size={12} /></button>
                    <button type="button" onClick={() => void deleteEntry(entry.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      <ProjectWorkload board={board} tasks={tasks} byTask={summary.byTask} />
    </div>
  )
}
