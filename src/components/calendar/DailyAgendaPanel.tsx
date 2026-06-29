import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { Plus, Check, Clock, Calendar, CheckSquare, Square, Trash2, ArrowRight, GripVertical } from 'lucide-react'
import type { CalendarEntry, CalendarEvent, Task, CalendarEntryType } from '../../types'
import { entryTypeIcon } from '../../utils/calendarEntry'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { useSettingsStore } from '../../store/settingsStore'
import BoardBadge from '../boards/BoardBadge'
import PriorityBadge from '../tasks/PriorityBadge'
import { eachEntryDate, eachEventDate } from '../../utils/events'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
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

interface DailyAgendaPanelProps {
  selectedDate: string
  tasks: Task[]
  events: CalendarEvent[]
  entries: CalendarEntry[]
  onTaskClick: (task: Task) => void
  onEventClick: (event: CalendarEvent) => void
  onEntryClick: (entry: CalendarEntry) => void
  onAddTask: () => void
  onAddEntry: () => void
}

export default function DailyAgendaPanel({
  selectedDate,
  tasks,
  events,
  entries,
  onTaskClick,
  onEventClick,
  onEntryClick,
  onAddTask,
  onAddEntry,
}: DailyAgendaPanelProps) {
  const { t, i18n } = useTranslation('calendar')
  const dateLocale = i18n.language === 'en' ? enUS : de

  const toggleTaskCompleted = useTasksStore((s) => s.toggleTaskCompleted)
  const toggleProjectTaskCompleted = useProjectTasksStore((s) => s.toggleTaskCompleted)
  const dailyAgendaOrder = useSettingsStore((s) => s.dailyAgendaOrder[selectedDate] ?? [])
  const setDailyAgendaOrder = useSettingsStore((s) => s.setDailyAgendaOrder)
  const hideCompletedTasks = useSettingsStore((s) => s.hideCompletedTasks)

  const taskSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Filter day items
  const unorderedDayTasks = tasks.filter((tk) => tk.dueDate === selectedDate && (!hideCompletedTasks || !tk.completed))
  const dayTasks =
    dailyAgendaOrder.length === 0
      ? unorderedDayTasks
      : [...unorderedDayTasks].sort((a, b) => {
          const ai = dailyAgendaOrder.indexOf(a.id)
          const bi = dailyAgendaOrder.indexOf(b.id)
          return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi)
        })
  const dayEvents = events.filter((e) => eachEventDate(e).includes(selectedDate))
  const dayEntries = entries.filter((en) => eachEntryDate(en).includes(selectedDate))

  // Sort timed vs untimed
  const timedEntries = dayEntries.filter((e) => !!e.startTime).sort((a, b) => a.startTime!.localeCompare(b.startTime!))
  const allDayEntries = dayEntries.filter((e) => !e.startTime)
  
  const timedEvents = dayEvents.filter((e) => !!(e as any).startTime).sort((a, b) => (a as any).startTime.localeCompare((b as any).startTime))
  const allDayEvents = dayEvents.filter((e) => !(e as any).startTime)

  const parsedDate = parseISO(selectedDate)
  const formattedDayTitle = format(parsedDate, 'EEEE, d. MMMM yyyy', { locale: dateLocale })

  const hasItems = dayTasks.length > 0 || dayEvents.length > 0 || dayEntries.length > 0

  async function handleToggleTask(task: Task) {
    if (task.boardId) {
      await toggleProjectTaskCompleted(task.id)
    } else {
      toggleTaskCompleted(task.id)
    }
  }

  function handleTaskDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = dayTasks.map((t) => t.id)
    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    setDailyAgendaOrder(selectedDate, arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white/80 p-5 shadow-sm backdrop-blur-apple transition-all hover:shadow-md dark:border-racing-800 dark:bg-racing-900/80">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent">Tagesübersicht</span>
          <h3 className="text-base font-bold text-gray-800 dark:text-racing-100 sm:text-lg">{formattedDayTitle}</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onAddTask}
            className="flex items-center gap-1 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-accent-dark shadow-sm"
          >
            <Plus size={13} />
            Aufgabe
          </button>
          <button
            onClick={onAddEntry}
            className="flex items-center gap-1 rounded-xl border border-gray-200 bg-transparent px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-850"
          >
            <Plus size={13} />
            Termin
          </button>
        </div>
      </div>

      {!hasItems ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-150 py-10 text-center dark:border-racing-850">
          <Calendar size={28} className="mb-2 text-gray-300 dark:text-racing-750" />
          <p className="text-sm font-medium text-gray-400 dark:text-racing-400">
            Keine Termine oder Aufgaben für diesen Tag geplant.
          </p>
          <button
            onClick={onAddTask}
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            Jetzt erste Aufgabe eintragen <ArrowRight size={12} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Termine & Events Column */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Termine & Abwesenheiten</h4>
            <div className="space-y-2">
              {/* All-Day Events */}
              {[...allDayEvents, ...allDayEntries].map((item: any) => {
                const isEntry = 'type' in item
                return (
                  <div
                    key={item.id}
                    onClick={() => (isEntry ? onEntryClick(item) : onEventClick(item))}
                    className="group flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium text-white transition-transform hover:scale-[1.01] shadow-sm"
                    style={{ backgroundColor: item.color }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex-shrink-0">
                        {isEntry ? entryTypeIcon[item.type as CalendarEntryType] : '📅'}
                      </span>
                      <span className="truncate">{item.title}</span>
                    </div>
                    <span className="rounded bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                      Ganztägig
                    </span>
                  </div>
                )
              })}

              {/* Timed Events */}
              {[...timedEvents, ...timedEntries]
                .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''))
                .map((item: any) => {
                  const isEntry = 'type' in item
                  return (
                    <div
                      key={item.id}
                      onClick={() => (isEntry ? onEntryClick(item) : onEventClick(item))}
                      className="group flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-sm transition-all hover:bg-gray-100/70 dark:border-racing-850 dark:bg-racing-950/40 dark:hover:bg-racing-850/40"
                    >
                      <div
                        className="flex h-10 w-1 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-400">
                            {isEntry ? entryTypeIcon[item.type as CalendarEntryType] : '📅'}
                          </span>
                          <p className="font-semibold text-gray-800 dark:text-racing-100 truncate">{item.title}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock size={11} />
                          <span>
                            {item.startTime}
                            {item.endTime ? ` – ${item.endTime}` : ''}
                          </span>
                        </div>
                      </div>
                      {isEntry && item.invitees && item.invitees.length > 0 && (
                        <div className="flex -space-x-1">
                          {item.invitees.slice(0, 3).map((inv: any) => (
                            <span
                              key={inv.id}
                              title={inv.display_name}
                              className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white dark:ring-racing-900"
                              style={{ backgroundColor: inv.avatar_color }}
                            >
                              {inv.display_name[0].toUpperCase()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

              {dayEvents.length === 0 && dayEntries.length === 0 && (
                <p className="py-2 text-xs italic text-gray-400">Keine Termine für diesen Tag.</p>
              )}
            </div>
          </div>

          {/* Aufgaben Column */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Aufgaben (To-Do)</h4>
            <DndContext sensors={taskSensors} collisionDetection={closestCenter} onDragEnd={handleTaskDragEnd}>
              <SortableContext items={dayTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {dayTasks.map((task) => (
                    <SortableDayTask
                      key={task.id}
                      task={task}
                      onToggle={() => handleToggleTask(task)}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {dayTasks.length === 0 && (
              <p className="py-2 text-xs italic text-gray-400">Keine Aufgaben für diesen Tag.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface SortableDayTaskProps {
  task: Task
  onToggle: () => void
  onClick: () => void
}

function SortableDayTask({ task, onToggle, onClick }: SortableDayTaskProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-2 rounded-xl border border-gray-100 p-3 transition-all dark:border-racing-850 ${
        task.completed ? 'bg-gray-50/50 opacity-60 dark:bg-racing-950/20' : 'bg-white dark:bg-racing-950/30'
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-0.5 flex-shrink-0 cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing dark:text-racing-700 dark:hover:text-racing-400"
      >
        <GripVertical size={14} />
      </button>
      <button onClick={onToggle} className="mt-0.5 flex-shrink-0 text-gray-400 hover:text-accent">
        {task.completed ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} />}
      </button>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onClick}>
        <p
          className={`text-sm font-semibold text-gray-800 dark:text-racing-100 truncate ${
            task.completed ? 'line-through text-gray-400' : ''
          }`}
        >
          {task.title}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <PriorityBadge priority={task.priority} />
          {task.boardId && <BoardBadge boardId={task.boardId} />}
          {task.urgent && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/40 dark:text-red-400">
              Dringend
            </span>
          )}
          {task.important && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
              Wichtig
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
