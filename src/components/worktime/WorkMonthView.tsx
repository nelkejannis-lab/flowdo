import { useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { toISODate } from '../../utils/date'
import { dayTargetMinutes, formatHM, netMinutes } from '../../utils/worktime'

const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export default function WorkMonthView() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd })
  const monthNet = monthDays.reduce((sum, day) => sum + netMinutes(entries[toISODate(day)]), 0)
  const monthTarget = monthDays.reduce((sum, day) => sum + dayTargetMinutes(day, settings), 0)
  const monthDiff = monthNet - monthTarget

  return (
    <div className="rounded-xl border border-gray-100 dark:border-racing-800">
      <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-racing-800">
        <button
          onClick={() => setCurrentMonth((d) => addMonths(d, -1))}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold capitalize">{format(currentMonth, 'MMMM yyyy', { locale: de })}</span>
        <button
          onClick={() => setCurrentMonth((d) => addMonths(d, 1))}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"
        >
          <ChevronRight size={18} />
        </button>
      </div>

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
          const entry = entries[iso]
          const target = dayTargetMinutes(day, settings)
          const net = netMinutes(entry)
          const diff = net - target
          const inMonth = isSameMonth(day, currentMonth)
          const today = isSameDay(day, new Date())

          return (
            <div
              key={iso}
              className={`min-h-[72px] border-b border-r border-gray-100 p-1.5 last:border-r-0 dark:border-racing-800 ${
                inMonth ? '' : 'bg-gray-50/50 dark:bg-racing-900/30'
              }`}
            >
              <div
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  today ? 'bg-accent text-white' : inMonth ? 'text-gray-700 dark:text-racing-100' : 'text-gray-300 dark:text-racing-400'
                }`}
              >
                {format(day, 'd')}
              </div>
              {entry && entry.workedMinutes > 0 && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-medium">{formatHM(net)}</span>
                  {diff !== 0 && (
                    <span className={`text-xs ${diff > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                      {diff > 0 ? '+' : ''}
                      {formatHM(diff)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center justify-between p-3 text-sm">
        <span className="font-semibold">Monat gesamt: {formatHM(monthNet)}</span>
        <span className={`font-semibold ${monthDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {monthDiff >= 0 ? '+' : ''}
          {formatHM(monthDiff)}
        </span>
      </div>
    </div>
  )
}
