import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import Modal from '../layout/Modal'
import { useBoardsStore } from '../../store/boardsStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { formatFriendlyDate } from '../../utils/date'

interface BoardTasksModalProps {
  boardId: string
  onClose: () => void
}

export default function BoardTasksModal({ boardId, onClose }: BoardTasksModalProps) {
  const { t } = useTranslation('boards')
  const board = useBoardsStore((s) => s.boards.find((b) => b.id === boardId))
  const tasks = useProjectTasksStore((s) => s.tasks)
  const fetchTasks = useProjectTasksStore((s) => s.fetchTasks)
  const toggleTaskCompleted = useProjectTasksStore((s) => s.toggleTaskCompleted)

  useEffect(() => {
    fetchTasks(boardId)
  }, [fetchTasks, boardId])

  if (!board) return null

  const total = tasks.length
  const done = tasks.filter((t) => t.completed).length
  const progress = total === 0 ? 0 : Math.round((done / total) * 100)

  return (
    <Modal title={board.title} onClose={onClose} widthClass="max-w-2xl">
      <div className="mb-4">
        {board.description && (
          <p className="mb-2 text-sm text-gray-500 dark:text-racing-200">{board.description}</p>
        )}
        <div className="flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-racing-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${progress}%`, backgroundColor: board.color }}
            />
          </div>
          <span className="text-xs font-medium text-gray-500 dark:text-racing-200">
            {t('tasksModal.done', { done, total })}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {board.columns.map((column) => {
          const columnTasks = tasks.filter((t) => t.columnId === column.id)
          return (
            <div key={column.id}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {column.title} ({columnTasks.length})
              </h3>
              {columnTasks.length === 0 && (
                <p className="text-sm text-gray-400">{t('tasksModal.noTasks')}</p>
              )}
              <div className="flex flex-col gap-1">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-racing-800"
                  >
                    <button
                      onClick={() => toggleTaskCompleted(task.id)}
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                        task.completed
                          ? 'border-accent bg-accent text-white'
                          : 'border-gray-300 dark:border-racing-600'
                      }`}
                    >
                      {task.completed && <Check size={12} />}
                    </button>
                    <span
                      className={`flex-1 truncate text-sm ${
                        task.completed ? 'text-gray-400 line-through' : ''
                      }`}
                    >
                      {task.title}
                    </span>
                    {task.dueDate && (
                      <span className="text-xs text-gray-400">{formatFriendlyDate(task.dueDate)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 text-right">
        <Link
          to={`/projekte/${board.id}`}
          onClick={onClose}
          className="text-sm font-medium text-accent hover:underline"
        >
          {t('tasksModal.openProject')}
        </Link>
      </div>
    </Modal>
  )
}
