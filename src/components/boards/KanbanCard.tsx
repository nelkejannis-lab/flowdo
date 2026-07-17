import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronDown, ListChecks, Lock } from 'lucide-react'
import type { Task } from '../../types'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { formatFriendlyDate, isOverdue } from '../../utils/date'
import PriorityBadge from '../tasks/PriorityBadge'
import TaskTimer from '../tasks/TaskTimer'

interface KanbanCardProps {
  task: Task
  onClick: () => void
}

export default function KanbanCard({ task, onClick }: KanbanCardProps) {
  const toggleTaskCompleted = useProjectTasksStore((s) => s.toggleTaskCompleted)
  const toggleSubtask = useProjectTasksStore((s) => s.toggleSubtask)
  const blocked = useProjectTasksStore((s) => !task.completed && s.isBlocked(task.id))
  const [expanded, setExpanded] = useState(false)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })
  const overdue = isOverdue(task.dueDate) && !task.completed
  const hasSubtasks = task.subtasks.length > 0

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="flex cursor-pointer flex-col gap-2 rounded-lg border border-gray-100 bg-white p-3 text-sm shadow-sm hover:shadow dark:border-racing-800 dark:bg-racing-900"
    >
      <div className="flex items-start gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleTaskCompleted(task.id)
          }}
          className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border-2 ${
            task.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
          }`}
        >
          {task.completed && <Check size={10} />}
        </button>
        <span className={`mt-0.5 ${task.completed ? 'opacity-80' : ''}`}>
          <TaskTimer taskId={task.id} boardId={task.boardId} title={task.title} compact />
        </span>
        <span className={`flex-1 font-medium ${task.completed ? 'text-gray-400 line-through' : ''}`}>
          {task.title}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {blocked && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            <Lock size={10} />
            Blockiert
          </span>
        )}
        {task.dueDate && (
          <span className={`text-xs ${overdue ? 'font-medium text-red-500' : 'text-gray-400'}`}>
            {formatFriendlyDate(task.dueDate)}
          </span>
        )}
        {hasSubtasks && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-racing-200"
          >
            <ListChecks size={12} />
            {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
            <ChevronDown size={12} className={`transition-transform duration-150 ${expanded ? '' : '-rotate-90'}`} />
          </button>
        )}
        {task.assignee && (
          <span
            className="ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: task.assignee.avatar_color }}
            title={task.assignee.display_name}
          >
            {task.assignee.display_name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {expanded && hasSubtasks && (
        <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 dark:border-racing-800">
          {task.subtasks.map((subtask) => (
            <button
              key={subtask.id}
              onClick={(e) => {
                e.stopPropagation()
                toggleSubtask(task.id, subtask.id)
              }}
              className="flex items-center gap-2 text-left text-xs"
            >
              <span
                className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  subtask.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
                }`}
              >
                {subtask.completed && <Check size={8} />}
              </span>
              <span className={subtask.completed ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-racing-200'}>
                {subtask.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
