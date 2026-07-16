import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlarmClock, CircleDot, Eye, EyeOff, Flame, Snowflake } from 'lucide-react'
import { useTasksStore } from '../store/tasksStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { useSettingsStore } from '../store/settingsStore'
import { isSupabaseConfigured } from '../lib/supabase'
import EisenhowerQuadrant from '../components/tasks/EisenhowerQuadrant'
import TaskFormModal from '../components/tasks/TaskFormModal'
import ProjectTaskFormModal from '../components/boards/ProjectTaskFormModal'
import { useBoardsStore } from '../store/boardsStore'
import type { Task } from '../types'

export default function EisenhowerPage() {
  const { t } = useTranslation('eisenhower')
  const personalTasks = useTasksStore((s) => s.tasks)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const fetchMyTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const hideCompletedTasks = useSettingsStore((s) => s.hideCompletedTasks)
  const toggleHideCompletedTasks = useSettingsStore((s) => s.toggleHideCompletedTasks)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const tasks = useMemo(() => {
    const all = [...personalTasks, ...myProjectTasks]
    return hideCompletedTasks ? all.filter((task) => !task.completed) : all
  }, [personalTasks, myProjectTasks, hideCompletedTasks])

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchMyTasks()
      fetchBoards()
    }
  }, [fetchMyTasks, fetchBoards])

  const editingBoard = editingTask?.boardId ? boards.find((b) => b.id === editingTask.boardId) : undefined
  const [newTaskQuadrant, setNewTaskQuadrant] = useState<{ urgent: boolean; important: boolean } | null>(null)

  const quadrants = [
    {
      urgent: true,
      important: true,
      title: t('quadrants.urgentImportant'),
      colorClass: 'text-red-500',
      icon: <Flame size={16} />,
    },
    {
      urgent: false,
      important: true,
      title: t('quadrants.notUrgentImportant'),
      colorClass: 'text-amber-500',
      icon: <AlarmClock size={16} />,
    },
    {
      urgent: true,
      important: false,
      title: t('quadrants.urgentNotImportant'),
      colorClass: 'text-blue-500',
      icon: <CircleDot size={16} />,
    },
    {
      urgent: false,
      important: false,
      title: t('quadrants.notUrgentNotImportant'),
      colorClass: 'text-emerald-500',
      icon: <Snowflake size={16} />,
    },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('page.title')}</h1>
          <p className="text-sm text-gray-400">{t('page.intro')}</p>
        </div>
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
            tasks={tasks.filter((task) => task.urgent === q.urgent && task.important === q.important)}
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
          defaultUrgent={newTaskQuadrant.urgent}
          defaultImportant={newTaskQuadrant.important}
          onClose={() => setNewTaskQuadrant(null)}
        />
      )}
    </div>
  )
}
