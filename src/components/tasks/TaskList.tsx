import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Task } from '../../types'
import { dateGroupLabel, dateGroupOrder } from '../../utils/date'
import { useBoardsStore } from '../../store/boardsStore'
import TaskItem from './TaskItem'
import TaskFormModal from './TaskFormModal'
import ProjectTaskFormModal from '../boards/ProjectTaskFormModal'

interface TaskListProps {
  tasks: Task[]
  groupByDate?: boolean
  emptyMessage?: string
  flat?: boolean
}

export default function TaskList({ tasks, groupByDate = false, emptyMessage = 'Keine Aufgaben', flat = false }: TaskListProps) {
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)
  const boards = useBoardsStore((s) => s.boards)
  const editingBoard = editingTask?.boardId ? boards.find((b) => b.id === editingTask.boardId) : undefined

  const activeTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks])
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks])

  const groups = useMemo(() => {
    if (!groupByDate) return { Alle: activeTasks }
    const map = new Map<string, Task[]>()
    for (const task of activeTasks) {
      const label = dateGroupLabel(task.dueDate)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(task)
    }
    const ordered: Record<string, Task[]> = {}
    for (const label of dateGroupOrder) {
      if (map.has(label)) ordered[label] = map.get(label)!
    }
    for (const [label, items] of map) {
      if (!(label in ordered)) ordered[label] = items
    }
    return ordered
  }, [activeTasks, groupByDate])

  if (tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">{emptyMessage}</p>
  }

  if (flat) {
    return (
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} onClick={() => setEditingTask(task)} />
        ))}

        {editingTask && editingBoard && (
          <ProjectTaskFormModal board={editingBoard} task={editingTask} onClose={() => setEditingTask(null)} />
        )}
        {editingTask && !editingBoard && <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {activeTasks.length === 0 && completedTasks.length > 0 && (
        <p className="py-4 text-center text-sm text-gray-400">Alle Aufgaben erledigt 🎉</p>
      )}

      {Object.entries(groups).map(([label, items]) => (
        <div key={label}>
          {groupByDate && (
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {label}
            </h3>
          )}
          <div className="flex flex-col gap-2">
            {items.map((task) => (
              <TaskItem key={task.id} task={task} onClick={() => setEditingTask(task)} />
            ))}
          </div>
        </div>
      ))}

      {completedTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-racing-200"
          >
            <ChevronDown
              size={15}
              className={`transition-transform duration-150 ${showCompleted ? '' : '-rotate-90'}`}
            />
            <span className="font-medium">Erledigt ({completedTasks.length})</span>
          </button>

          {showCompleted && (
            <div className="mt-2 flex flex-col gap-2 opacity-60">
              {completedTasks.map((task) => (
                <TaskItem key={task.id} task={task} onClick={() => setEditingTask(task)} />
              ))}
            </div>
          )}
        </div>
      )}

      {editingTask && editingBoard && (
        <ProjectTaskFormModal board={editingBoard} task={editingTask} onClose={() => setEditingTask(null)} />
      )}
      {editingTask && !editingBoard && <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} />}
    </div>
  )
}
