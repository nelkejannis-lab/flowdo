import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Check, ListChecks } from 'lucide-react'
import type { Task } from '../../types'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { formatFriendlyDate, isOverdue } from '../../utils/date'
import PriorityBadge from '../tasks/PriorityBadge'

interface KanbanCardProps {
  task: Task
  onClick: () => void
}

export default function KanbanCard({ task, onClick }: KanbanCardProps) {
  const toggleTaskCompleted = useProjectTasksStore((s) => s.toggleTaskCompleted)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })
  const overdue = isOverdue(task.dueDate) && !task.completed

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
        <span className={`flex-1 font-medium ${task.completed ? 'text-gray-400 line-through' : ''}`}>
          {task.title}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <span className={`text-xs ${overdue ? 'font-medium text-red-500' : 'text-gray-400'}`}>
            {formatFriendlyDate(task.dueDate)}
          </span>
        )}
        {task.subtasks.length > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <ListChecks size={12} />
            {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
          </span>
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
    </div>
  )
}
