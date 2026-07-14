import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Flag, Plus, Trash2 } from 'lucide-react'
import { useBoardMilestonesStore } from '../../store/boardMilestonesStore'
import { formatFriendlyDate, todayISO, isOverdue } from '../../utils/date'

interface Props {
  boardId: string
}

export default function BoardMilestones({ boardId }: Props) {
  const { t } = useTranslation('boards')
  const milestones = useBoardMilestonesStore((s) => s.milestones.filter((m) => m.boardId === boardId))
  const fetchByBoard = useBoardMilestonesStore((s) => s.fetchByBoard)
  const addMilestone = useBoardMilestonesStore((s) => s.addMilestone)
  const toggleMilestone = useBoardMilestonesStore((s) => s.toggleMilestone)
  const deleteMilestone = useBoardMilestonesStore((s) => s.deleteMilestone)
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(todayISO())

  useEffect(() => {
    void fetchByBoard(boardId)
  }, [boardId, fetchByBoard])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    await addMilestone(boardId, title.trim(), dueDate)
    setTitle('')
  }

  return (
    <div className="rounded-xl border border-gray-100 p-4 dark:border-racing-800">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Flag size={14} />
        {t('milestones.title')}
      </h3>
      <form onSubmit={handleAdd} className="mb-3 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('milestones.placeholder')}
          className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-racing-700"
        />
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm dark:border-racing-700" />
        <button type="submit" className="rounded-lg bg-accent px-2 py-1.5 text-white">
          <Plus size={14} />
        </button>
      </form>
      {milestones.length === 0 ? (
        <p className="text-xs text-gray-400">{t('milestones.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {milestones.map((m) => (
            <li key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-racing-800">
              <button type="button" onClick={() => void toggleMilestone(m.id)}
                className={`h-4 w-4 rounded border-2 ${m.completed ? 'border-accent bg-accent' : 'border-gray-300'}`} />
              <span className={`flex-1 text-sm ${m.completed ? 'line-through text-gray-400' : ''}`}>{m.title}</span>
              <span className="text-xs text-gray-400">{formatFriendlyDate(m.dueDate)}</span>
              <button type="button" onClick={() => void deleteMilestone(m.id)} className="text-gray-300 hover:text-red-500">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
