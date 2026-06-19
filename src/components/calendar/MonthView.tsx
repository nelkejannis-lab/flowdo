import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addDays,
  format,
} from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import type { CalendarEntry, CalendarEvent, Task } from '../../types'
import { toISODate } from '../../utils/date'
import { eachEntryDate, eachEventDate } from '../../utils/events'
import { entryTypeIcon } from '../../utils/calendarEntry'
import { useCalendarEntriesStore } from '../../store/calendarEntriesStore'

interface MonthViewProps {
  currentDate: Date
  tasks: Task[]
  events: CalendarEvent[]
  entries?: CalendarEntry[]
  onDayClick: (date: Date) => void
  onTaskClick: (task: Task) => void
  onEventClick: (event: CalendarEvent) => void
  onEntryClick?: (entry: CalendarEntry) => void
}

export default function MonthView({ currentDate, tasks, events, entries = [], onDayClick, onTaskClick, onEventClick, onEntryClick }: MonthViewProps) {
  const { t, i18n } = useTranslation('calendar')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const updateEntry = useCalendarEntriesStore((s) => s.updateEntry)

  const [draggingEntry, setDraggingEntry] = useState<CalendarEntry | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)

  const weekStartForLabels = startOfWeek(new Date(), { weekStartsOn: 1 })
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStartForLabels, i), 'EEEEEE', { locale: dateLocale })
  )
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

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

  function handleDrop(targetDate: string) {
    if (!draggingEntry || draggingEntry.date === targetDate) {
      setDraggingEntry(null)
      setDragOverDate(null)
      return
    }
    updateEntry(draggingEntry.id, {
      type: draggingEntry.type,
      title: draggingEntry.title,
      description: draggingEntry.description,
      date: targetDate,
      endDate: undefined,
      startTime: draggingEntry.startTime,
      endTime: draggingEntry.endTime,
      color: draggingEntry.color,
      invitedUserIds: draggingEntry.invitees.map((i) => i.id),
      recurrence: draggingEntry.recurrence,
    })
    setDraggingEntry(null)
    setDragOverDate(null)
  }

  return (
    <div className="rounded-xl border border-gray-100 dark:border-racing-800">
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-racing-800">
        {weekdays.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase text-gray-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const iso = toISODate(day)
          const dayTasks = tasksByDate.get(iso) ?? []
          const dayEvents = eventsByDate.get(iso) ?? []
          const dayEntries = entriesByDate.get(iso) ?? []
          const inMonth = isSameMonth(day, currentDate)
          const today = isSameDay(day, new Date())
          const isDragTarget = dragOverDate === iso

          return (
            <div
              key={iso}
              onClick={() => onDayClick(day)}
              onDragOver={(e) => { e.preventDefault(); setDragOverDate(iso) }}
              onDragLeave={() => setDragOverDate(null)}
              onDrop={(e) => { e.preventDefault(); handleDrop(iso) }}
              className={`min-h-[100px] cursor-pointer border-b border-r border-gray-100 p-1.5 last:border-r-0 dark:border-racing-800 transition-colors ${
                inMonth ? '' : 'bg-gray-50/50 dark:bg-racing-900/30'
              } ${isDragTarget ? 'bg-accent/10 ring-2 ring-inset ring-accent/30' : ''}`}
            >
              <div
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  today ? 'bg-accent text-white' : inMonth ? 'text-gray-700 dark:text-racing-100' : 'text-gray-300 dark:text-racing-400'
                }`}
              >
                {format(day, 'd')}
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.map((event) => (
                  <div
                    key={event.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventClick(event)
                    }}
                    className="truncate rounded px-1.5 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: event.color }}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation()
                      setDraggingEntry(entry)
                    }}
                    onDragEnd={() => { setDraggingEntry(null); setDragOverDate(null) }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEntryClick?.(entry)
                    }}
                    className={`flex cursor-grab items-center gap-1 truncate rounded px-1.5 py-0.5 text-xs font-medium text-white active:cursor-grabbing ${
                      draggingEntry?.id === entry.id ? 'opacity-40' : ''
                    }`}
                    style={{ backgroundColor: entry.color }}
                  >
                    <span className="truncate">{entryTypeIcon[entry.type]} {entry.title}</span>
                    {entry.invitees.length > 0 && (
                      <span className="flex flex-shrink-0 -space-x-1">
                        {entry.invitees.slice(0, 3).map((inv) => (
                          <span
                            key={inv.id}
                            title={inv.display_name}
                            className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold text-white ring-1 ring-white/40"
                            style={{ backgroundColor: inv.avatar_color }}
                          >
                            {inv.display_name[0].toUpperCase()}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTaskClick(task)
                    }}
                    className={`truncate rounded px-1.5 py-0.5 text-xs ${
                      task.completed
                        ? 'bg-gray-100 text-gray-400 line-through dark:bg-racing-800'
                        : 'bg-accent/10 text-accent'
                    }`}
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-xs text-gray-400">{t('moreCount', { count: dayTasks.length - 3 })}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
