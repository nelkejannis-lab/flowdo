import { Check } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Task } from '../../types'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { formatFriendlyDate, isOverdue } from '../../utils/date'
import BoardBadge from '../boards/BoardBadge'
import TaskTimer from './TaskTimer'

interface EisenhowerTaskRowProps {
  task: Task
  onClick: () => void
}

export default function EisenhowerTaskRow({ task, onClick }: EisenhowerTaskRowProps) {
  const toggleTaskCompleted = useTasksStore((s) => s.toggleTaskCompleted)
  const toggleProjectTaskCompleted = useProjectTasksStore((s) => s.toggleTaskCompleted)
  const overdue = isOverdue(task.dueDate) && !task.completed
  const isProject = Boolean(task.boardId)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { taskId: task.id, isProject },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.45 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className="flex cursor-grab active:cursor-grabbing items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-racing-800/60"
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          if (isProject) toggleProjectTaskCompleted(task.id)
          else toggleTaskCompleted(task.id)
        }}
        className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border-2 ${
          task.completed ? 'border-accent bg-accent text-white' : 'border-gray-300 dark:border-racing-600'
        }`}
      >
        {task.completed && <Check size={10} />}
      </button>
      <span className={`flex-1 truncate ${task.completed ? 'text-gray-400 line-through' : ''}`}>
        {task.title}
      </span>
      <TaskTimer
        taskId={task.id}
        boardId={task.boardId}
        title={task.title}
        compact
        className={task.completed ? 'opacity-80' : ''}
      />
      {task.boardId && <BoardBadge boardId={task.boardId} />}
      {task.dueDate && (
        <span className={`flex-shrink-0 text-xs ${overdue ? 'font-medium text-red-500' : 'text-gray-400'}`}>
          {formatFriendlyDate(task.dueDate)}
        </span>
      )}
    </div>
  )
}
