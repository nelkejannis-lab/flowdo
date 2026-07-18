import { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, ListOrdered, CalendarRange } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface PriorityPlanTask {
  id: string
  title: string
  priority?: string
  dueDate?: string
}

interface Props {
  mode: 'day' | 'week'
  tasks: PriorityPlanTask[]
  initialOrder?: string[]
  onSave: (orderedIds: string[]) => void
  onClose: () => void
  onSkip?: () => void
}

const priorityDot: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-400',
}

function SortableRow({
  task,
  rank,
}: {
  task: PriorityPlanTask
  rank: number
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-2xl bg-black/[0.03] px-2.5 py-2.5 dark:bg-white/[0.04]"
    >
      <button
        type="button"
        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold tabular-nums text-accent"
        aria-label={`#${rank}`}
      >
        {rank}
      </button>
      <button
        type="button"
        className="flex-shrink-0 cursor-grab touch-none p-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing dark:text-racing-600"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <span
        className={`h-2 w-2 flex-shrink-0 rounded-full ${priorityDot[task.priority ?? ''] ?? 'bg-gray-400'}`}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
    </div>
  )
}

export default function PriorityPlanModal({
  mode,
  tasks,
  initialOrder,
  onSave,
  onClose,
  onSkip,
}: Props) {
  const { t } = useTranslation('dashboard')
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const seeded = useMemo(() => {
    if (!initialOrder?.length) return tasks.map((tk) => tk.id)
    const ids = new Set(tasks.map((tk) => tk.id))
    const ordered = initialOrder.filter((id) => ids.has(id))
    for (const tk of tasks) {
      if (!ordered.includes(tk.id)) ordered.push(tk.id)
    }
    return ordered
  }, [tasks, initialOrder])

  const [order, setOrder] = useState<string[]>(seeded)

  useEffect(() => {
    setOrder(seeded)
  }, [seeded])

  const byId = useMemo(() => new Map(tasks.map((tk) => [tk.id, tk])), [tasks])
  const orderedTasks = order.map((id) => byId.get(id)).filter(Boolean) as PriorityPlanTask[]

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setOrder((prev) => {
      const oldIndex = prev.indexOf(String(active.id))
      const newIndex = prev.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  function moveUp(id: string) {
    setOrder((prev) => {
      const i = prev.indexOf(id)
      if (i <= 0) return prev
      return arrayMove(prev, i, i - 1)
    })
  }

  const title =
    mode === 'day' ? t('priorityPlan.dayTitle') : t('priorityPlan.weekTitle')
  const subtitle =
    mode === 'day' ? t('priorityPlan.daySubtitle') : t('priorityPlan.weekSubtitle')
  const Icon = mode === 'day' ? ListOrdered : CalendarRange

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-[3px] sm:items-center sm:p-6">
      <div className="bento-card relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="relative overflow-hidden px-5 pb-3 pt-5 sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/15 via-transparent to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-gray-400 hover:bg-black/[0.05] hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={t('priorityPlan.close')}
          >
            <X size={16} strokeWidth={1.6} />
          </button>
          <div className="relative flex items-start gap-3 pr-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Icon size={22} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-racing-300">{subtitle}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-2 sm:px-6">
          {orderedTasks.length === 0 ? (
            <p className="rounded-2xl bg-black/[0.03] px-3 py-6 text-center text-sm text-gray-400 dark:bg-white/[0.04]">
              {t('priorityPlan.empty')}
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {orderedTasks.map((tk, idx) => (
                    <div key={tk.id} className="group relative">
                      <SortableRow task={tk} rank={idx + 1} />
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => moveUp(tk.id)}
                          className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-lg px-2 py-1 text-[10px] font-semibold text-accent hover:bg-accent/10 sm:group-hover:block"
                        >
                          ↑
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <p className="mt-3 text-[11px] text-gray-400">{t('priorityPlan.hint')}</p>
        </div>

        <div className="border-t border-black/[0.05] p-4 dark:border-white/[0.06] sm:p-5">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSkip ?? onClose}
              className="flex-1 rounded-full bg-black/[0.04] py-2.5 text-sm font-semibold text-gray-700 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-racing-100"
            >
              {t('priorityPlan.later')}
            </button>
            <button
              type="button"
              onClick={() => onSave(order)}
              disabled={orderedTasks.length === 0}
              className="flex-[1.4] rounded-full bg-accent py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/25 hover:brightness-110 disabled:opacity-40"
            >
              {t('priorityPlan.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
