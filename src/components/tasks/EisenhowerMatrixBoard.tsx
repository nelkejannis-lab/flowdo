import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { AlarmClock, CircleDot, Eye, EyeOff, Flame, Snowflake } from 'lucide-react'
import type { Task } from '../../types'
import { useBoardsStore } from '../../store/boardsStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import { clearMatrixPlacement, isMatrixPlaced, matrixPlacement } from '../../utils/eisenhower'
import EisenhowerQuadrant from './EisenhowerQuadrant'
import EisenhowerUncategorized from './EisenhowerUncategorized'
import TaskFormModal from './TaskFormModal'
import ProjectTaskFormModal from '../boards/ProjectTaskFormModal'

export const MATRIX_DROP_UNCATEGORIZED = 'matrix:uncategorized'

export function matrixDropId(urgent: boolean, important: boolean) {
  return `matrix:${urgent ? '1' : '0'}:${important ? '1' : '0'}`
}

export function parseMatrixDropId(
  id: string
): { kind: 'uncategorized' } | { kind: 'quadrant'; urgent: boolean; important: boolean } | null {
  if (id === MATRIX_DROP_UNCATEGORIZED) return { kind: 'uncategorized' }
  const match = /^matrix:([01]):([01])$/.exec(id)
  if (!match) return null
  return { kind: 'quadrant', urgent: match[1] === '1', important: match[2] === '1' }
}

interface EisenhowerMatrixBoardProps {
  tasks: Task[]
  defaultDueDate?: string
  showTitle?: boolean
  includeNeitherQuadrant?: boolean
}

export default function EisenhowerMatrixBoard({
  tasks,
  defaultDueDate,
  showTitle = false,
  includeNeitherQuadrant = true,
}: EisenhowerMatrixBoardProps) {
  const { t } = useTranslation('eisenhower')
  const boards = useBoardsStore((s) => s.boards)
  const hideCompletedTasks = useSettingsStore((s) => s.hideCompletedTasks)
  const toggleHideCompletedTasks = useSettingsStore((s) => s.toggleHideCompletedTasks)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskQuadrant, setNewTaskQuadrant] = useState<{ urgent: boolean; important: boolean } | null>(null)
  const editingBoard = editingTask?.boardId ? boards.find((b) => b.id === editingTask.boardId) : undefined

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  )

  const visibleTasks = useMemo(
    () => (hideCompletedTasks ? tasks.filter((task) => !task.completed) : tasks),
    [tasks, hideCompletedTasks]
  )

  const placedTasks = useMemo(() => visibleTasks.filter(isMatrixPlaced), [visibleTasks])
  const uncategorizedTasks = useMemo(() => visibleTasks.filter((task) => !isMatrixPlaced(task)), [visibleTasks])

  const quadrants = useMemo(() => {
    const all = [
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
    return includeNeitherQuadrant ? all : all.filter((q) => q.urgent || q.important)
  }, [t, includeNeitherQuadrant])

  async function assignTask(taskId: string, isProject: boolean, updates: Partial<Task>) {
    if (isProject) {
      await useProjectTasksStore.getState().updateTask(taskId, updates)
      if (isSupabaseConfigured) useProjectTasksStore.getState().fetchMyTasks()
    } else {
      useTasksStore.getState().updateTask(taskId, updates)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const drop = parseMatrixDropId(String(over.id))
    if (!drop) return

    const data = active.data.current as { taskId?: string; isProject?: boolean } | undefined
    const taskId = data?.taskId ?? String(active.id)
    const isProject = Boolean(data?.isProject)
    const updates =
      drop.kind === 'uncategorized' ? clearMatrixPlacement() : matrixPlacement(drop.urgent, drop.important)
    await assignTask(taskId, isProject, updates)
  }

  return (
    <div>
      <div className={`mb-4 flex flex-wrap items-start justify-between gap-3 ${showTitle ? 'mb-6' : 'mb-3'}`}>
        {showTitle ? (
          <div>
            <h1 className="text-2xl font-semibold">{t('page.title')}</h1>
            <p className="text-sm text-gray-400">{t('page.intro')}</p>
          </div>
        ) : (
          <div />
        )}
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

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {quadrants.map((q) => (
            <EisenhowerQuadrant
              key={q.title}
              droppableId={matrixDropId(q.urgent, q.important)}
              title={q.title}
              colorClass={q.colorClass}
              icon={q.icon}
              urgent={q.urgent}
              important={q.important}
              tasks={placedTasks.filter((task) => task.urgent === q.urgent && task.important === q.important)}
              onTaskClick={(task) => setEditingTask(task)}
              onAddTask={() => setNewTaskQuadrant({ urgent: q.urgent, important: q.important })}
            />
          ))}
        </div>

        <EisenhowerUncategorized
          droppableId={MATRIX_DROP_UNCATEGORIZED}
          tasks={uncategorizedTasks}
          onTaskClick={(task) => setEditingTask(task)}
        />
      </DndContext>

      {editingTask && editingBoard && (
        <ProjectTaskFormModal board={editingBoard} task={editingTask} onClose={() => setEditingTask(null)} />
      )}
      {editingTask && !editingBoard && <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} />}
      {newTaskQuadrant && (
        <TaskFormModal
          defaultDueDate={defaultDueDate}
          defaultUrgent={newTaskQuadrant.urgent}
          defaultImportant={newTaskQuadrant.important}
          defaultMatrixPlaced
          onClose={() => setNewTaskQuadrant(null)}
        />
      )}
    </div>
  )
}
