import { useEffect, useState } from 'react'
import { AlarmClock, CircleDot, Flame, Snowflake } from 'lucide-react'
import { useTasksStore } from '../store/tasksStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { isSupabaseConfigured } from '../lib/supabase'
import EisenhowerQuadrant from '../components/tasks/EisenhowerQuadrant'
import TaskFormModal from '../components/tasks/TaskFormModal'
import ProjectTaskFormModal from '../components/boards/ProjectTaskFormModal'
import { useBoardsStore } from '../store/boardsStore'
import type { Task } from '../types'

export default function EisenhowerPage() {
  const personalTasks = useTasksStore((s) => s.tasks.filter((t) => !t.completed))
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks.filter((t) => !t.completed))
  const fetchMyTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const tasks = [...personalTasks, ...myProjectTasks]
  const [editingTask, setEditingTask] = useState<Task | null>(null)

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
      title: 'Dringend & Wichtig',
      colorClass: 'text-red-500',
      icon: <Flame size={16} />,
    },
    {
      urgent: false,
      important: true,
      title: 'Nicht dringend & Wichtig',
      colorClass: 'text-amber-500',
      icon: <AlarmClock size={16} />,
    },
    {
      urgent: true,
      important: false,
      title: 'Dringend & Unwichtig',
      colorClass: 'text-blue-500',
      icon: <CircleDot size={16} />,
    },
    {
      urgent: false,
      important: false,
      title: 'Nicht dringend & Unwichtig',
      colorClass: 'text-emerald-500',
      icon: <Snowflake size={16} />,
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Eisenhower-Matrix</h1>
        <p className="text-sm text-gray-400">Priorisiere Aufgaben nach Dringlichkeit und Wichtigkeit</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {quadrants.map((q) => (
          <EisenhowerQuadrant
            key={q.title}
            title={q.title}
            colorClass={q.colorClass}
            icon={q.icon}
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
          defaultUrgent={newTaskQuadrant.urgent}
          defaultImportant={newTaskQuadrant.important}
          onClose={() => setNewTaskQuadrant(null)}
        />
      )}
    </div>
  )
}
