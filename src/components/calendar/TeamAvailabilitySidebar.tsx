import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import type { CalendarEntry } from '../../types'
import { todayISO } from '../../utils/date'
import { entryTypeIcon, entryTypeLabel } from '../../utils/calendarEntry'

interface TeamAvailabilitySidebarProps {
  entries: CalendarEntry[]
}

export default function TeamAvailabilitySidebar({ entries }: TeamAvailabilitySidebarProps) {
  const today = todayISO()

  const relevant = entries
    .filter((e) => e.type === 'reise' || e.type === 'urlaub')
    .filter((e) => (e.endDate ?? e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <aside className="w-full shrink-0 rounded-xl border border-gray-100 p-3 dark:border-racing-800 lg:w-64">
      <h2 className="mb-2 text-sm font-semibold">Außerhaus &amp; Urlaub</h2>
      {relevant.length === 0 && <p className="text-xs text-gray-400">Aktuell ist niemand außerhaus oder im Urlaub.</p>}
      <div className="flex flex-col gap-2">
        {relevant.map((entry) => {
          const name = entry.owner?.display_name ?? 'Unbekannt'
          const isMultiDay = !!entry.endDate && entry.endDate > entry.date
          return (
            <div
              key={entry.id}
              className="rounded-lg border border-gray-100 p-2 text-xs dark:border-racing-800"
            >
              <div className="flex items-center gap-1.5 font-medium">
                <span
                  className="inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: entry.owner?.avatar_color ?? entry.color }}
                />
                {name}
              </div>
              <p className="mt-0.5 text-gray-500">
                {entryTypeIcon[entry.type]} {entryTypeLabel[entry.type]}
                {entry.title ? `: ${entry.title}` : ''}
              </p>
              <p className="mt-0.5 text-gray-400">
                {isMultiDay
                  ? `${format(parseISO(entry.date), 'd. MMM', { locale: de })} – ${format(parseISO(entry.endDate!), 'd. MMM', { locale: de })}`
                  : format(parseISO(entry.date), 'd. MMM', { locale: de })}
                {(entry.startTime || entry.endTime) && (
                  <span>
                    {', '}
                    {entry.startTime ?? ''}
                    {entry.endTime ? ` – ${entry.endTime}` : ''} Uhr
                  </span>
                )}
              </p>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
