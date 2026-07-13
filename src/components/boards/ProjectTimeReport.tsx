import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Plus } from 'lucide-react'
import type { Board, Task } from '../../types'
import { useTaskTimeStore } from '../../store/taskTimeStore'
import { useAuthStore } from '../../store/authStore'
import { todayISO } from '../../utils/date'
import { formatHM } from '../../utils/worktime'

interface Props {
  board: Board
  tasks: Task[]
}

export default function ProjectTimeReport({ board, tasks }: Props) {
  const { t } = useTranslation('boards')
  const userId = useAuthStore((s) => s.user?.id)
  const fetchByBoard = useTaskTimeStore((s) => s.fetchByBoard)
  const addEntry = useTaskTimeStore((s) => s.addEntry)
  const getBoardSummary = useTaskTimeStore((s) => s.getBoardSummary)
  const [minutes, setMinutes] = useState(30)
  const [taskId, setTaskId] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    void fetchByBoard(board.id)
  }, [board.id, fetchByBoard])

  const openTasks = tasks.filter((tk) => !tk.completed)
  const done = tasks.filter((tk) => tk.completed).length
  const progress = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)
  const summary = getBoardSummary(board.id, tasks.map((tk) => tk.id))

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
    <div className="rounded-xl border border-gray-100 p-4 dark:border-racing-800">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Clock size={14} />
        {t('timeReport.title')}
      </h3>
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-racing-800">
          <p className="text-xs text-gray-400">{t('timeReport.totalTime')}</p>
          <p className="text-lg font-bold">{formatHM(summary.totalMinutes)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-racing-800">
          <p className="text-xs text-gray-400">{t('timeReport.progress')}</p>
          <p className="text-lg font-bold">{progress}%</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-3 dark:bg-racing-800">
          <p className="text-xs text-gray-400">{t('timeReport.openTasks')}</p>
          <p className="text-lg font-bold">{openTasks.length}</p>
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
            return (
              <li key={id} className="flex justify-between">
                <span className="truncate">{tk?.title ?? id}</span>
                <span className="font-medium">{formatHM(mins)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
