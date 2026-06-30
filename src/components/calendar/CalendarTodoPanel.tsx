import { useTranslation } from 'react-i18next'
import { GripVertical, CalendarPlus } from 'lucide-react'
import type { Task } from '../../types'
import { addDays } from 'date-fns'
import { toISODate, formatFriendlyDate } from '../../utils/date'
import PriorityBadge from '../tasks/PriorityBadge'

interface CalendarTodoPanelProps {
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

// Unscheduled todos for the next 7 days. Drag one onto the week grid to schedule it
// (the grid's drop handler sets its time). Only tasks WITHOUT a start time appear here —
// once scheduled they show as a block in the calendar instead.
export default function CalendarTodoPanel({ tasks, onTaskClick }: CalendarTodoPanelProps) {
  const { t } = useTranslation('calendar')
  const today = toISODate(new Date())
  const weekAhead = toISODate(addDays(new Date(), 7))

  const upcoming = tasks
    .filter((tk) => !tk.completed && !tk.startTime && tk.dueDate && tk.dueDate >= today && tk.dueDate <= weekAhead)
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <h3 className="mb-1 text-sm font-semibold">{t('todoPanel.title')}</h3>
      <p className="mb-3 text-xs text-gray-400">{t('todoPanel.hint')}</p>
      {upcoming.length === 0 ? (
        <p className="py-4 text-center text-xs italic text-gray-400">{t('todoPanel.empty')}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {upcoming.map((tk) => (
            <div
              key={tk.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/todo-id', tk.id)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onClick={() => onTaskClick(tk)}
              className="group flex cursor-grab items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/50 px-2 py-1.5 active:cursor-grabbing dark:border-racing-850 dark:bg-racing-950/30"
            >
              <GripVertical size={13} className="flex-shrink-0 text-gray-300 group-hover:text-gray-400" />
              <span className="min-w-0 flex-1 truncate text-sm">{tk.title}</span>
              <PriorityBadge priority={tk.priority} />
              {tk.dueDate && <span className="flex-shrink-0 text-[11px] text-gray-400">{formatFriendlyDate(tk.dueDate)}</span>}
              <CalendarPlus size={13} className="flex-shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
