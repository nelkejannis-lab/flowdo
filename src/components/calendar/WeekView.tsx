import { startOfWeek, addDays, isSameDay, format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import type { CalendarEntry, CalendarEvent, Task } from '../../types'
import { toISODate } from '../../utils/date'
import { eachEntryDate, eachEventDate } from '../../utils/events'
import { entryTypeIcon } from '../../utils/calendarEntry'
import TaskItem from '../tasks/TaskItem'

interface WeekViewProps {
  currentDate: Date
  tasks: Task[]
  events: CalendarEvent[]
  entries?: CalendarEntry[]
  onTaskClick: (task: Task) => void
  onAddTask: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
  onEntryClick?: (entry: CalendarEntry) => void
}

export default function WeekView({ currentDate, tasks, events, entries = [], onTaskClick, onAddTask, onEventClick, onEntryClick }: WeekViewProps) {
  const { t, i18n } = useTranslation('calendar')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const tasksByDate = new Map<string, Task[]>()
  for (const task of tasks) {
    if (!task.dueDate) continue
    if (!tasksByDate.has(task.dueDate)) tasksByDate.set(task.dueDate, [])
    tasksByDate.get(task.dueDate)!.push(task)
  }

  const eventsByDate = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    for (const iso of eachEventDate(event)) {
      if (!eventsByDate.has(iso)) eventsByDate.set(iso, [])
      eventsByDate.get(iso)!.push(event)
    }
  }

  const entriesByDate = new Map<string, CalendarEntry[]>()
  for (const entry of entries) {
    for (const iso of eachEntryDate(entry)) {
      if (!entriesByDate.has(iso)) entriesByDate.set(iso, [])
      entriesByDate.get(iso)!.push(entry)
    }
  }

  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="flex min-w-[560px] gap-2 px-1">
        {days.map((day) => {
          const iso = toISODate(day)
          const dayTasks = tasksByDate.get(iso) ?? []
          const dayEvents = eventsByDate.get(iso) ?? []
          const dayEntries = entriesByDate.get(iso) ?? []
          const today = isSameDay(day, new Date())

          return (
            <div
              key={iso}
              className={`min-w-0 flex-1 rounded-xl border p-2 ${
                today ? 'border-accent bg-accent/[0.03]' : 'border-gray-100 dark:border-racing-800'
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {format(day, 'EEE', { locale: dateLocale })}
                  </p>
                  <p className={`text-xs font-semibold ${today ? 'text-accent' : ''}`}>
                    {format(day, 'd. MMM', { locale: dateLocale })}
                  </p>
                </div>
                <button
                  onClick={() => onAddTask(day)}
                  className="flex-shrink-0 rounded p-0.5 text-gray-300 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
                >
                  +
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={() => onEventClick(event)}
                    className="cursor-pointer truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: event.color }}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    onClick={() => onEntryClick?.(entry)}
                    className="cursor-pointer truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium text-white"
                    style={{ backgroundColor: entry.color }}
                  >
                    {entryTypeIcon[entry.type]} {entry.title}
                    {(entry.startTime || entry.endTime) && (
                      <span className="ml-1 opacity-80">
                        {entry.startTime ?? ''}
                        {entry.endTime ? `–${entry.endTime}` : ''}
                      </span>
                    )}
                  </div>
                ))}
                {dayTasks.map((task) => (
                  <TaskItem key={task.id} task={task} onClick={() => onTaskClick(task)} showBoard={false} />
                ))}
                {dayEvents.length === 0 && dayEntries.length === 0 && dayTasks.length === 0 && (
                  <p className="text-[11px] text-gray-300">{t('weekday.noTasks')}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
