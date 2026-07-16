import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlarmClock, CircleDot, Eye, EyeOff, Flame } from 'lucide-react'
import type { Task } from '../../types'
import { useBoardsStore } from '../../store/boardsStore'
import { useSettingsStore } from '../../store/settingsStore'
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
  const hideCompletedTasks = useSettingsStore((s) => s.hideCompletedTasks)
  const toggleHideCompletedTasks = useSettingsStore((s) => s.toggleHideCompletedTasks)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskQuadrant, setNewTaskQuadrant] = useState<{ urgent: boolean; important: boolean } | null>(null)
  const editingBoard = editingTask?.boardId ? boards.find((b) => b.id === editingTask.boardId) : undefined

  const visibleTasks = useMemo(
    () => (hideCompletedTasks ? tasks.filter((task) => !task.completed) : tasks),
    [tasks, hideCompletedTasks]
  )

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
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={toggleHideCompletedTasks}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            hideCompletedTasks
              ? 'bg-accent text-white'
              : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
          }`}
          title={t('page.hideCompleted')}
        >
          {hideCompletedTasks ? <EyeOff size={14} /> : <Eye size={14} />}
          {t('page.hideCompleted')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {quadrants.map((q) => (
          <EisenhowerQuadrant
            key={q.title}
            title={q.title}
            colorClass={q.colorClass}
            icon={q.icon}
            urgent={q.urgent}
            important={q.important}
            tasks={visibleTasks.filter((task) => task.urgent === q.urgent && task.important === q.important)}
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
