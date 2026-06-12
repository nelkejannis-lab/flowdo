import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Plus } from 'lucide-react'
import type { CalendarEntry, CalendarEvent, Task } from '../../types'
import { toISODate } from '../../utils/date'
import { eachEntryDate, eachEventDate } from '../../utils/events'
import { entryTypeIcon, entryTypeLabel } from '../../utils/calendarEntry'
import TaskList from '../tasks/TaskList'

interface DayViewProps {
  currentDate: Date
  tasks: Task[]
  events: CalendarEvent[]
  entries?: CalendarEntry[]
  onAddTask: () => void
  onEventClick: (event: CalendarEvent) => void
  onEntryClick?: (entry: CalendarEntry) => void
}

export default function DayView({ currentDate, tasks, events, entries = [], onAddTask, onEventClick, onEntryClick }: DayViewProps) {
  const iso = toISODate(currentDate)
  const dayTasks = tasks.filter((t) => t.dueDate === iso)
  const dayEvents = events.filter((e) => eachEventDate(e).includes(iso))
  const dayEntries = entries.filter((en) => eachEntryDate(en).includes(iso))

  return (
    <div className="rounded-xl border border-gray-100 p-4 dark:border-racing-800">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {format(currentDate, 'EEEE, d. MMMM yyyy', { locale: de })}
        </h2>
        <button
          onClick={onAddTask}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={14} />
          Aufgabe
        </button>
      </div>
      {dayEvents.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {dayEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => onEventClick(event)}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: event.color }}
            >
              {event.title}
              {event.endDate && event.endDate > event.date && (
                <p className="mt-0.5 text-xs font-normal opacity-90">
                  {format(parseISO(event.date), 'd. MMM', { locale: de })} – {format(parseISO(event.endDate), 'd. MMM', { locale: de })}
                </p>
              )}
              {event.description && <p className="mt-0.5 text-xs font-normal opacity-90">{event.description}</p>}
            </div>
          ))}
        </div>
      )}
      {dayEntries.length > 0 && (
        <div className="mb-4 flex flex-col gap-2">
          {dayEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => onEntryClick?.(entry)}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: entry.color }}
            >
              {entryTypeIcon[entry.type]} {entryTypeLabel[entry.type]}: {entry.title}
              {(entry.startTime || entry.endTime || (entry.endDate && entry.endDate > entry.date)) && (
                <p className="mt-0.5 text-xs font-normal opacity-90">
                  {entry.endDate && entry.endDate > entry.date
                    ? `${format(parseISO(entry.date), 'd. MMM', { locale: de })} – ${format(parseISO(entry.endDate), 'd. MMM', { locale: de })}`
                    : ''}
                  {(entry.startTime || entry.endTime) && (
                    <span>
                      {entry.endDate && entry.endDate > entry.date ? ' · ' : ''}
                      {entry.startTime ?? ''}
                      {entry.endTime ? ` – ${entry.endTime}` : ''} Uhr
                    </span>
                  )}
                </p>
              )}
              {entry.description && <p className="mt-0.5 text-xs font-normal opacity-90">{entry.description}</p>}
              {entry.invitees.length > 0 && (
                <p className="mt-0.5 text-xs font-normal opacity-90">
                  Mit {entry.invitees.map((i) => i.display_name).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      <TaskList tasks={dayTasks} emptyMessage="Keine Aufgaben für diesen Tag" />
    </div>
  )
}
