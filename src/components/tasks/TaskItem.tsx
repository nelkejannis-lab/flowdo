import { useState } from 'react'
import { Check, ChevronDown, ChevronRight, ListChecks } from 'lucide-react'
import type { Task } from '../../types'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { formatFriendlyDate, isOverdue } from '../../utils/date'
import BoardBadge from '../boards/BoardBadge'
import PriorityBadge from './PriorityBadge'

interface TaskItemProps {
  task: Task
  onClick?: () => void
  showBoard?: boolean
}

export default function TaskItem({ task, onClick, showBoard = true }: TaskItemProps) {
  const toggleTaskCompleted = useTasksStore((s) => s.toggleTaskCompleted)
  const toggleProjectTaskCompleted = useProjectTasksStore((s) => s.toggleTaskCompleted)
  const toggleSubtask = useTasksStore((s) => s.toggleSubtask)
  const toggleProjectSubtask = useProjectTasksStore((s) => s.toggleSubtask)
  const [expanded, setExpanded] = useState(false)
  const overdue = isOverdue(task.dueDate) && !task.completed
  const hasSubtasks = task.subtasks.length > 0
  const subtaskDone = task.subtasks.filter((s) => s.completed).length

  return (
    <div className="rounded-lg border border-gray-100 bg-white transition-colors hover:border-gray-200 dark:border-racing-800 dark:bg-racing-900 dark:hover:border-racing-700">
      <div onClick={onClick} className="flex cursor-pointer items-center gap-3 px-3 py-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (task.boardId) {
              toggleProjectTaskCompleted(task.id)
            } else {
              toggleTaskCompleted(task.id)
            }
          }}
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
            task.completed
              ? 'border-accent bg-accent text-white'
              : 'border-gray-300 dark:border-racing-600'
          }`}
        >
          {task.completed && <Check size={12} />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${task.completed ? 'text-gray-400 line-through' : ''}`}>
            {task.title}
          </p>
          {(task.dueDate || hasSubtasks) && (
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
              {task.dueDate && (
                <span className={overdue ? 'font-medium text-red-500' : ''}>
                  {formatFriendlyDate(task.dueDate)}
                </span>
              )}
              {hasSubtasks && (
                <span className="flex items-center gap-1">
                  <ListChecks size={12} />
                  {subtaskDone}/{task.subtasks.length}
                </span>
              )}
            </div>
          )}
        </div>

        {task.tags.length > 0 && (
          <div className="hidden items-center gap-1 sm:flex">
            {task.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-racing-800 dark:text-racing-200"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
        <PriorityBadge priority={task.priority} />
        {showBoard && task.boardId && <BoardBadge boardId={task.boardId} />}
        {hasSubtasks && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            className="flex-shrink-0 rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
            title={expanded ? 'Unteraufgaben einklappen' : 'Unteraufgaben anzeigen'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        )}
      </div>

      {expanded && hasSubtasks && (
        <div className="flex flex-col gap-1 border-t border-gray-100 px-3 py-2 pl-10 dark:border-racing-800">
          {task.subtasks.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (task.boardId) {
                    toggleProjectSubtask(task.id, s.id)
                  } else {
                    toggleSubtask(task.id, s.id)
                  }
                }}
                className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  s.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
                }`}
              >
                {s.completed && <Check size={10} />}
              </button>
              <span className={`flex-1 text-sm ${s.completed ? 'text-gray-400 line-through' : ''}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
