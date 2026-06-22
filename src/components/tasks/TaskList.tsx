import { useMemo, useState } from 'react'
import { ChevronDown, GripVertical } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../../types'
import { dateGroupLabel, dateGroupOrder } from '../../utils/date'
import { useBoardsStore } from '../../store/boardsStore'
import { useTasksStore } from '../../store/tasksStore'
import { useSettingsStore } from '../../store/settingsStore'
import TaskItem from './TaskItem'
import TaskFormModal from './TaskFormModal'
import ProjectTaskFormModal from '../boards/ProjectTaskFormModal'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface TaskListProps {
  tasks: Task[]
  groupByDate?: boolean
  emptyMessage?: string
  flat?: boolean
}

// Maps the German labels returned by dateGroupLabel()/dateGroupOrder to translation keys.
const dateGroupLabelKeys: Record<string, string> = {
  'Überfällig': 'dateGroups.overdue',
  'Heute': 'dateGroups.today',
  'Heute Abend': 'dateGroups.tonight',
  'Morgen': 'dateGroups.tomorrow',
  'Diese Woche': 'dateGroups.thisWeek',
  'Später': 'dateGroups.later',
  'Ohne Datum': 'dateGroups.noDate',
}

function SortableTaskItem({ task, onClick }: { task: Task; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab touch-none p-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing dark:text-racing-600"
      >
        <GripVertical size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <TaskItem task={task} onClick={onClick} />
      </div>
    </div>
  )
}

export default function TaskList({ tasks, groupByDate = false, emptyMessage, flat = false }: TaskListProps) {
  const { t } = useTranslation('tasks')
  const resolvedEmptyMessage = emptyMessage ?? t('list.noTasks')
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const hideCompletedTasks = useSettingsStore((s) => s.hideCompletedTasks)
  const toggleHideCompletedTasks = useSettingsStore((s) => s.toggleHideCompletedTasks)
  const showCompleted = !hideCompletedTasks
  const [visibleCount, setVisibleCount] = useState(20)
  const boards = useBoardsStore((s) => s.boards)
  const reorderTasks = useTasksStore((s) => s.reorderTasks)
  const editingBoard = editingTask?.boardId ? boards.find((b) => b.id === editingTask.boardId) : undefined

  const activeTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks])
  const completedTasks = useMemo(() => tasks.filter((t) => t.completed), [tasks])

  const groups = useMemo(() => {
    if (!groupByDate) return { Alle: activeTasks }
    const map = new Map<string, Task[]>()
    for (const task of activeTasks) {
      let label = dateGroupLabel(task.dueDate)
      if (label === 'Heute' && task.evening) label = 'Heute Abend'
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const flatActive = activeTasks.map((t) => t.id)
    const oldIndex = flatActive.indexOf(active.id as string)
    const newIndex = flatActive.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    const newOrder = arrayMove(flatActive, oldIndex, newIndex)
    reorderTasks(newOrder)
  }

  if (tasks.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">{resolvedEmptyMessage}</p>
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

  const visibleActive = activeTasks.slice(0, visibleCount)

  return (
    <div className="flex flex-col gap-4">
      {activeTasks.length === 0 && completedTasks.length > 0 && (
        <p className="py-4 text-center text-sm text-gray-400">{t('list.allDone')}</p>
      )}

      {groupByDate ? (
        Object.entries(groups).map(([label, items]) => (
          <div key={label}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {dateGroupLabelKeys[label] ? t(dateGroupLabelKeys[label]) : label}
            </h3>
            <div className="flex flex-col gap-2">
              {items.map((task) => (
                <TaskItem key={task.id} task={task} onClick={() => setEditingTask(task)} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleActive.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {visibleActive.map((task) => (
                <SortableTaskItem key={task.id} task={task} onClick={() => setEditingTask(task)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!groupByDate && activeTasks.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((c) => c + 20)}
          className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-racing-200"
        >
          Mehr laden / Load more ({activeTasks.length - visibleCount} verbleibend)
        </button>
      )}

      {completedTasks.length > 0 && (
        <div>
          <button
            onClick={toggleHideCompletedTasks}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-racing-200"
          >
            <ChevronDown
              size={15}
              className={`transition-transform duration-150 ${showCompleted ? '' : '-rotate-90'}`}
            />
            <span className="font-medium">{t('list.completedCount', { count: completedTasks.length })}</span>
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
