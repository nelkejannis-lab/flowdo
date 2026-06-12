import { useMemo, useState } from 'react'
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
}

export default function TaskList({ tasks, groupByDate = false, emptyMessage = 'Keine Aufgaben' }: TaskListProps) {
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const boards = useBoardsStore((s) => s.boards)
  const editingBoard = editingTask?.boardId ? boards.find((b) => b.id === editingTask.boardId) : undefined

  const groups = useMemo(() => {
    if (!groupByDate) return { Alle: tasks }
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
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
  }, [tasks, groupByDate])

  if (tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">{emptyMessage}</p>
  }

  return (
    <div className="flex flex-col gap-4">
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
      {editingTask && editingBoard && (
        <ProjectTaskFormModal board={editingBoard} task={editingTask} onClose={() => setEditingTask(null)} />
      )}
      {editingTask && !editingBoard && <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} />}
    </div>
  )
}
