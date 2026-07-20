import { useMemo } from 'react'
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
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, ChevronUp, GripVertical, X, ListOrdered, CalendarRange } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  usePriorityPlanStore,
  type PriorityPlanModalTask,
} from '../../store/priorityPlanStore'

const priorityDot: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-400',
}

function SortableRow({
  task,
  rank,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  moveUpLabel,
  moveDownLabel,
}: {
  task: PriorityPlanModalTask
  rank: number
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  moveUpLabel: string
  moveDownLabel: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? transition : undefined,
    opacity: isDragging ? 0.45 : 1,
  }
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1 rounded-2xl bg-black/[0.03] py-1 pl-2 pr-1 touch-none dark:bg-white/[0.04] ${
        isDragging ? 'z-10 shadow-lg ring-2 ring-accent/30' : ''
      }`}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-grab items-center gap-2 py-1.5 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <span className="flex-shrink-0 text-gray-300 dark:text-racing-600" aria-hidden>
          <GripVertical size={16} />
        </span>
        <span
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold tabular-nums text-accent"
          aria-hidden
        >
          {rank}
        </span>
        <span
          className={`h-2 w-2 flex-shrink-0 rounded-full ${priorityDot[task.priority ?? ''] ?? 'bg-gray-400'}`}
        />
        <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{task.title}</span>
      </button>
      <div className="flex flex-shrink-0 flex-col gap-0.5">
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-black/[0.05] disabled:opacity-25 dark:hover:bg-white/10"
          aria-label={moveUpLabel}
        >
          <ChevronUp size={15} />
        </button>
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-black/[0.05] disabled:opacity-25 dark:hover:bg-white/10"
          aria-label={moveDownLabel}
        >
          <ChevronDown size={15} />
        </button>
      </div>
    </div>
  )
}

interface Props {
  onSave: (orderedIds: string[]) => void
  onClose: () => void
  onSkip?: () => void
}

/** Priority reorder UI — order lives in priorityPlanStore.modalDraft (not local React state). */
export default function PriorityPlanModal({ onSave, onClose, onSkip }: Props) {
  const { t } = useTranslation('dashboard')
  const draft = usePriorityPlanStore((s) => s.modalDraft)
  const moveItem = usePriorityPlanStore((s) => s.movePriorityModalItem)
  const reorderDrag = usePriorityPlanStore((s) => s.reorderPriorityModalDrag)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  )

  const byId = useMemo(
    () => new Map((draft?.tasks ?? []).map((tk) => [tk.id, tk])),
    [draft?.tasks],
  )
  const orderedTasks = useMemo(() => {
    if (!draft) return []
    return draft.order.map((id) => byId.get(id)).filter(Boolean) as PriorityPlanModalTask[]
  }, [draft, byId])

  if (!draft) return null

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderDrag(String(active.id), String(over.id))
  }

  const title =
    draft.mode === 'day' ? t('priorityPlan.dayTitle') : t('priorityPlan.weekTitle')
  const subtitle =
    draft.mode === 'day' ? t('priorityPlan.daySubtitle') : t('priorityPlan.weekSubtitle')
  const Icon = draft.mode === 'day' ? ListOrdered : CalendarRange

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-3 backdrop-blur-[3px] sm:items-center sm:p-6">
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
            <DndContext
              id={draft.scopeKey}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={draft.order} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {orderedTasks.map((tk, idx) => (
                    <SortableRow
                      key={tk.id}
                      task={tk}
                      rank={idx + 1}
                      canMoveUp={idx > 0}
                      canMoveDown={idx < orderedTasks.length - 1}
                      onMoveUp={() => moveItem(tk.id, -1)}
                      onMoveDown={() => moveItem(tk.id, 1)}
                      moveUpLabel={t('customize.moveUp')}
                      moveDownLabel={t('customize.moveDown')}
                    />
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
              onClick={() => onSave(draft.order)}
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
