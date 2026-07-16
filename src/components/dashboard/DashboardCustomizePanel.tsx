import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  Sliders,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  normalizeDashboardSectionOrder,
  type DashboardSectionId,
} from '../../lib/dashboardLayout'
import { useSettingsStore, type DashboardWidget } from '../../store/settingsStore'

const SECTION_I18N_KEY: Record<DashboardSectionId, string> = {
  todayHero: 'customize.sections.todayHero',
  weekFocus: 'customize.sections.weekFocus',
  weather: 'customize.sections.weather',
  dayPlan: 'customize.sections.dayPlan',
  topPriority: 'customize.sections.topPriority',
  dayCapacity: 'customize.sections.dayCapacity',
  weekOverview: 'customize.sections.weekOverview',
  dueThisWeek: 'customize.sections.dueThisWeek',
  workoffice: 'customize.sections.workoffice',
  stats: 'customize.sections.stats',
  upcomingDeadlines: 'customize.sections.upcomingDeadlines',
  nextEvents: 'customize.sections.nextEvents',
  projectsOverview: 'customize.sections.projectsOverview',
}

function SortableRow({
  id,
  label,
  visible,
  index,
  total,
  onToggle,
  onMove,
}: {
  id: DashboardSectionId
  label: string
  visible: boolean
  index: number
  total: number
  onToggle: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const { t } = useTranslation('dashboard')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.55 : 1 }}
      className={`flex items-center gap-2 rounded-xl border px-2 py-2 sm:gap-2.5 sm:px-3 ${
        visible
          ? 'border-black/[0.06] bg-white dark:border-white/[0.08] dark:bg-racing-900'
          : 'border-dashed border-black/[0.08] bg-black/[0.02] opacity-70 dark:border-white/[0.1] dark:bg-white/[0.03]'
      }`}
    >
      <button
        type="button"
        className="flex h-8 w-8 flex-shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-400 touch-none active:cursor-grabbing hover:bg-black/[0.04] hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-racing-200"
        title={t('customize.drag')}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>

      <span className={`min-w-0 flex-1 truncate text-sm font-medium ${visible ? '' : 'text-gray-400 line-through'}`}>
        {label}
      </span>

      <div className="flex flex-shrink-0 items-center gap-0.5">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-black/[0.04] disabled:opacity-30 dark:hover:bg-white/[0.06]"
          title={t('customize.moveUp')}
          aria-label={t('customize.moveUp')}
        >
          <ChevronUp size={16} />
        </button>
        <button
          type="button"
          disabled={index >= total - 1}
          onClick={() => onMove(1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-black/[0.04] disabled:opacity-30 dark:hover:bg-white/[0.06]"
          title={t('customize.moveDown')}
          aria-label={t('customize.moveDown')}
        >
          <ChevronDown size={16} />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
            visible
              ? 'text-accent hover:bg-accent/10'
              : 'text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
          }`}
          title={visible ? t('customize.hide') : t('customize.show')}
          aria-pressed={visible}
        >
          {visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>
    </div>
  )
}

export default function DashboardCustomizePanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('dashboard')
  const sectionOrder = useSettingsStore((s) =>
    normalizeDashboardSectionOrder(s.dashboardSectionOrder),
  )
  const visibility = useSettingsStore((s) => s.dashboardVisibility)
  const setSectionOrder = useSettingsStore((s) => s.setDashboardSectionOrder)
  const moveSection = useSettingsStore((s) => s.moveDashboardSection)
  const toggleWidget = useSettingsStore((s) => s.toggleDashboardWidget)
  const resetLayout = useSettingsStore((s) => s.resetDashboardLayout)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIndex = sectionOrder.indexOf(String(active.id) as DashboardSectionId)
    const newIndex = sectionOrder.indexOf(String(over.id) as DashboardSectionId)
    if (oldIndex < 0 || newIndex < 0) return
    setSectionOrder(arrayMove(sectionOrder, oldIndex, newIndex))
  }

  return (
    <div className="mb-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400 dark:text-racing-400">{t('customize.hintSticky')}</p>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-150 active:scale-95 ${
            open
              ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
              : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-racing-200 dark:hover:bg-white/[0.1]'
          }`}
        >
          {open ? (
            <>
              <Check size={14} />
              {t('customize.done')}
            </>
          ) : (
            <>
              <Sliders size={14} />
              {t('customize.open')}
            </>
          )}
        </button>
      </div>

      {open && (
        <div className="rounded-2xl border border-black/[0.06] bg-black/[0.015] p-3 shadow-apple-sm dark:border-white/[0.08] dark:bg-white/[0.03] sm:p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{t('customize.title')}</h3>
              <p className="mt-0.5 text-xs text-gray-400">{t('customize.subtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => resetLayout()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.06] bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-racing-900 dark:text-racing-200 dark:hover:bg-racing-800"
            >
              <RotateCcw size={12} />
              {t('customize.reset')}
            </button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-1.5">
                {sectionOrder.map((id, index) => (
                  <SortableRow
                    key={id}
                    id={id}
                    label={t(SECTION_I18N_KEY[id])}
                    visible={visibility[id as DashboardWidget] ?? true}
                    index={index}
                    total={sectionOrder.length}
                    onToggle={() => toggleWidget(id as DashboardWidget)}
                    onMove={(dir) => moveSection(id, dir)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  )
}
