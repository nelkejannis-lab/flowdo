import { Link } from 'react-router-dom'
import type { CalendarEntry } from '../../types'
import { entryTypeIcon } from '../../utils/calendarEntry'

interface Props {
  entries: CalendarEntry[]
  label: string
  today: string
}

export default function CalendarEntriesBlock({ entries, label, today }: Props) {
  if (entries.length === 0) return null

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          🗓️ {label}
        </h3>
        <Link to="/calendar" className="text-xs font-medium text-accent hover:underline">
          Kalender
        </Link>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
          >
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm text-white"
              style={{ backgroundColor: entry.color }}
            >
              {entryTypeIcon[entry.type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{entry.title}</p>
              {(entry.startTime || entry.endTime || (entry.endDate && entry.endDate > today)) && (
                <p className="text-xs text-gray-400">
                  {entry.startTime && entry.endTime
                    ? `${entry.startTime} – ${entry.endTime}`
                    : entry.startTime ?? entry.endTime ?? ''}
                  {entry.endDate && entry.endDate > today ? (entry.startTime ? ' · läuft noch' : 'läuft noch') : ''}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
