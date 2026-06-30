import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import type { CalendarEntry, CalendarEvent, Task } from '../../types'
import { toISODate } from '../../utils/date'
import { eachEntryDate, eachEventDate } from '../../utils/events'
import { entryTypeIcon } from '../../utils/calendarEntry'
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

const HOURS = Array.from({ length: 24 }, (_, i) => i)

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

export default function DayView({ currentDate, tasks, events, entries = [], onAddTask, onEventClick, onEntryClick }: DayViewProps) {
  const { t, i18n } = useTranslation('calendar')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const iso = toISODate(currentDate)

  const dayTasks = tasks.filter((tk) => tk.dueDate === iso)
  const dayEvents = events.filter((e) => eachEventDate(e).includes(iso))
  const dayEntries = entries.filter((en) => eachEntryDate(en).includes(iso))

  // Split: timed entries vs all-day entries
  const timedEntries = dayEntries.filter((e) => !!e.startTime)
  const allDayEntries = dayEntries.filter((e) => !e.startTime)
  const timedEvents = dayEvents.filter((e) => !!(e as any).startTime)
  const allDayEvents = dayEvents.filter((e) => !(e as any).startTime)

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes()
  const isToday = iso === toISODate(new Date())

  // Height per hour in px
  const HOUR_H = 56

  return (
    <div className="rounded-xl border border-gray-100 dark:border-racing-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-racing-800">
        <h2 className="text-base font-semibold">
          {format(currentDate, 'EEEE, d. MMMM yyyy', { locale: dateLocale })}
        </h2>
      </div>

      {/* All-day section */}
      {(allDayEntries.length > 0 || allDayEvents.length > 0) && (
        <div className="border-b border-gray-100 px-4 py-2 dark:border-racing-800">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Ganztägig</div>
          <div className="flex flex-col gap-1">
            {allDayEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => onEventClick(event)}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: event.color }}
              >
                {event.title}
              </div>
            ))}
            {allDayEntries.map((entry) => (
              <div
                key={entry.id}
                onClick={() => onEntryClick?.(entry)}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: entry.color }}
              >
                {entryTypeIcon[entry.type]} {entry.title}
                {entry.endDate && entry.endDate > entry.date && (
                  <span className="ml-2 text-xs font-normal opacity-80">
                    {format(parseISO(entry.date), 'd. MMM', { locale: dateLocale })} – {format(parseISO(entry.endDate), 'd. MMM', { locale: dateLocale })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hourly grid */}
      <div className="relative overflow-y-auto" style={{ maxHeight: '65vh' }}>
        <div className="relative" style={{ height: HOUR_H * 24 }}>
          {/* Hour rows */}
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 flex border-b border-gray-100 dark:border-racing-800/60"
              style={{ top: h * HOUR_H, height: HOUR_H }}
            >
              <div className="w-14 flex-shrink-0 pr-2 pt-1 text-right text-[10px] font-medium text-gray-400 select-none">
                {h === 0 ? '' : `${h.toString().padStart(2, '0')}:00`}
              </div>
              <div className="flex-1" />
            </div>
          ))}

          {/* Now line */}
          {isToday && (
            <div
              className="absolute left-14 right-0 z-20 flex items-center gap-1"
              style={{ top: (nowMinutes / 60) * HOUR_H }}
            >
              <div className="h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
              <div className="h-px flex-1 bg-red-500" />
            </div>
          )}

          {/* Timed events (external) */}
          {timedEvents.map((event) => {
            const start = timeToMinutes((event as any).startTime ?? '00:00')
            const end = (event as any).endTime ? timeToMinutes((event as any).endTime) : start + 60
            const top = (start / 60) * HOUR_H
            const height = Math.max(((end - start) / 60) * HOUR_H, 28)
            return (
              <div
                key={event.id}
                onClick={() => onEventClick(event)}
                className="absolute left-16 right-2 z-10 cursor-pointer overflow-hidden rounded-lg px-2 py-1 text-xs font-medium text-white shadow-sm"
                style={{ top, height, backgroundColor: event.color }}
              >
                <div className="font-semibold truncate">{event.title}</div>
                <div className="opacity-80">{(event as any).startTime}{(event as any).endTime ? ` – ${(event as any).endTime}` : ''}</div>
              </div>
            )
          })}

          {/* Timed calendar entries */}
          {timedEntries.map((entry) => {
            const start = timeToMinutes(entry.startTime!)
            const end = entry.endTime ? timeToMinutes(entry.endTime) : start + 60
            const top = (start / 60) * HOUR_H
            const height = Math.max(((end - start) / 60) * HOUR_H, 28)
            return (
              <div
                key={entry.id}
                onClick={() => onEntryClick?.(entry)}
                className="absolute left-16 right-2 z-10 cursor-pointer overflow-hidden rounded-lg px-2 py-1 text-xs font-medium text-white shadow-sm"
                style={{ top, height, backgroundColor: entry.color }}
              >
                <div className="font-semibold truncate">{entryTypeIcon[entry.type]} {entry.title}</div>
                <div className="opacity-80">{entry.startTime}{entry.endTime ? ` – ${entry.endTime}` : ''}</div>
                {entry.invitees.length > 0 && (
                  <div className="mt-0.5 flex -space-x-1">
                    {entry.invitees.slice(0, 4).map((inv) => (
                      <span
                        key={inv.id}
                        title={inv.display_name}
                        className="flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold text-white ring-1 ring-white/40"
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
        </div>
      </div>

      {allDayEntries.length === 0 && timedEntries.length === 0 && allDayEvents.length === 0 && timedEvents.length === 0 && (
        <div className="p-6 text-center text-sm text-gray-400">{t('day.noTasksForDay')}</div>
      )}
    </div>
  )
}
