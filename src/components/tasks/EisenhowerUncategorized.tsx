import { useTranslation } from 'react-i18next'
import { useDroppable } from '@dnd-kit/core'
import { Inbox } from 'lucide-react'
import type { Task } from '../../types'
import EisenhowerTaskRow from './EisenhowerTaskRow'

interface EisenhowerUncategorizedProps {
  droppableId: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

export default function EisenhowerUncategorized({
  droppableId,
  tasks,
  onTaskClick,
}: EisenhowerUncategorizedProps) {
  const { t } = useTranslation('eisenhower')
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })

  return (
    <div
      ref={setNodeRef}
      className={`mt-4 rounded-xl border p-3 transition-colors ${
        isOver
          ? 'border-accent bg-accent/5 shadow-md'
          : 'border-gray-100 bg-white dark:border-racing-800 dark:bg-racing-900'
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-racing-200">
        <Inbox size={16} />
        {t('uncategorized.title')}
        <span className="font-normal text-gray-400">{tasks.length}</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">{t('uncategorized.hint')}</p>
      {tasks.length === 0 ? (
        <p className="py-3 text-center text-xs text-gray-300">{t('uncategorized.empty')}</p>
      ) : (
        <div className="flex max-h-72 flex-col overflow-y-auto">
          {tasks.map((task) => (
            <EisenhowerTaskRow key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </div>
      )}
    </div>
  )
}
