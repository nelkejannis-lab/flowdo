import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlarmClock, CircleDot, Flame } from 'lucide-react'
import type { Task } from '../../types'
import { useBoardsStore } from '../../store/boardsStore'
import EisenhowerQuadrant from './EisenhowerQuadrant'
import TaskFormModal from './TaskFormModal'
import ProjectTaskFormModal from '../boards/ProjectTaskFormModal'

interface TaskEisenhowerGridProps {
  tasks: Task[]
  defaultDueDate?: string
}

// Same 4-quadrant view as the standalone Eisenhower page, but scoped to whatever task
// set the caller already filtered (e.g. "Today", "This week") instead of all tasks.
export default function TaskEisenhowerGrid({ tasks, defaultDueDate }: TaskEisenhowerGridProps) {
  const { t } = useTranslation('eisenhower')
  const boards = useBoardsStore((s) => s.boards)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskQuadrant, setNewTaskQuadrant] = useState<{ urgent: boolean; important: boolean } | null>(null)
  const editingBoard = editingTask?.boardId ? boards.find((b) => b.id === editingTask.boardId) : undefined

  // Only the three quadrants that represent an explicit choice. Tasks with neither
  // "urgent" nor "important" set are intentionally NOT shown — they are uncategorized
  // and must not be auto-dumped into a "neither" bucket.
  const quadrants = [
    { urgent: true, important: true, title: t('quadrants.urgentImportant'), colorClass: 'text-red-500', icon: <Flame size={16} /> },
    { urgent: false, important: true, title: t('quadrants.notUrgentImportant'), colorClass: 'text-amber-500', icon: <AlarmClock size={16} /> },
    { urgent: true, important: false, title: t('quadrants.urgentNotImportant'), colorClass: 'text-blue-500', icon: <CircleDot size={16} /> },
  ]

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {quadrants.map((q) => (
          <EisenhowerQuadrant
            key={q.title}
            title={q.title}
            colorClass={q.colorClass}
            icon={q.icon}
            urgent={q.urgent}
            important={q.important}
            tasks={tasks.filter((t) => t.urgent === q.urgent && t.important === q.important)}
            onTaskClick={(task) => setEditingTask(task)}
            onAddTask={() => setNewTaskQuadrant({ urgent: q.urgent, important: q.important })}
          />
        ))}
      </div>

      {editingTask && editingBoard && (
        <ProjectTaskFormModal board={editingBoard} task={editingTask} onClose={() => setEditingTask(null)} />
      )}
      {editingTask && !editingBoard && <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} />}
      {newTaskQuadrant && (
        <TaskFormModal
          defaultDueDate={defaultDueDate}
          defaultUrgent={newTaskQuadrant.urgent}
          defaultImportant={newTaskQuadrant.important}
          onClose={() => setNewTaskQuadrant(null)}
        />
      )}
    </div>
  )
}
