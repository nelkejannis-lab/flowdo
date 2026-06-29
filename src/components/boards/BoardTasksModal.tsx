import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check, ChevronDown, ListChecks } from 'lucide-react'
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
  const toggleSubtask = useProjectTasksStore((s) => s.toggleSubtask)
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null)

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
                {columnTasks.map((task) => {
                  const hasSubtasks = task.subtasks.length > 0
                  const subtaskDone = task.subtasks.filter((s) => s.completed).length
                  const isExpanded = expandedTaskId === task.id
                  return (
                    <div key={task.id} className="rounded-lg hover:bg-gray-50 dark:hover:bg-racing-800">
                      <div className="flex items-center gap-2 px-2 py-1.5">
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
                        {hasSubtasks && (
                          <span className="flex items-center gap-1 text-[11px] text-gray-400">
                            <ListChecks size={11} />
                            {subtaskDone}/{task.subtasks.length}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className="text-xs text-gray-400">{formatFriendlyDate(task.dueDate)}</span>
                        )}
                        {hasSubtasks && (
                          <button
                            onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                            className="flex-shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-racing-700"
                          >
                            <ChevronDown size={14} className={`transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`} />
                          </button>
                        )}
                      </div>
                      {isExpanded && hasSubtasks && (
                        <div className="flex flex-col gap-1 px-2 pb-2 pl-9">
                          {task.subtasks.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-2 py-0.5">
                              <button
                                onClick={() => toggleSubtask(task.id, sub.id)}
                                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                  sub.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
                                }`}
                              >
                                {sub.completed && <Check size={10} />}
                              </button>
                              <span className={`flex-1 text-sm ${sub.completed ? 'text-gray-400 line-through' : ''}`}>
                                {sub.title}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
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
