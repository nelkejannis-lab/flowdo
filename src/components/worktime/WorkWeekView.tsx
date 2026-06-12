import { Fragment, useState } from 'react'
import { addDays, addWeeks, eachDayOfInterval, format, isToday, startOfWeek } from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { toISODate } from '../../utils/date'
import { dayTargetMinutes, formatHM, hoursValueToMinutes, minutesToHoursValue, netMinutes } from '../../utils/worktime'

export default function WorkWeekView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)
  const setWorkedMinutes = useWorkTimeStore((s) => s.setWorkedMinutes)
  const setBreakMinutes = useWorkTimeStore((s) => s.setBreakMinutes)

  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

  const weekNet = days.reduce((sum, day) => sum + netMinutes(entries[toISODate(day)]), 0)
  const weekTarget = days.reduce((sum, day) => sum + dayTargetMinutes(day, settings), 0)

  return (
    <div className="rounded-xl border border-gray-100 dark:border-racing-800">
      <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-racing-800">
        <button
          onClick={() => setWeekStart((d) => addWeeks(d, -1))}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold">
          {format(weekStart, 'd. MMM', { locale: de })} – {format(addDays(weekStart, 6), 'd. MMM yyyy', { locale: de })}
        </span>
        <button
          onClick={() => setWeekStart((d) => addWeeks(d, 1))}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 p-3 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tag</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Gearbeitet (h)</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Pause (Min.)</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Soll</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Diff.</div>

        {days.map((day) => {
          const iso = toISODate(day)
          const entry = entries[iso]
          const target = dayTargetMinutes(day, settings)
          const net = netMinutes(entry)
          const diff = net - target

          return (
            <Fragment key={iso}>
              <div className={`flex items-center gap-2 py-1 ${isToday(day) ? 'font-semibold text-accent' : ''}`}>
                {format(day, 'EEEE, d.MM.', { locale: de })}
              </div>
              <div className="flex items-center justify-end py-1">
                <input
                  type="number"
                  min={0}
                  step={0.25}
                  value={entry ? minutesToHoursValue(netMinutes(entry)) : ''}
                  placeholder="0"
                  onChange={(e) => {
                    const breakMin = entry ? entry.breakMinutes : settings.defaultBreakMinutes
                    setWorkedMinutes(iso, hoursValueToMinutes(Number(e.target.value)) + breakMin)
                  }}
                  className="w-16 rounded-md border border-gray-200 bg-transparent px-2 py-1 text-right text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
              <div className="flex items-center justify-end py-1">
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={entry ? entry.breakMinutes : ''}
                  placeholder={String(settings.defaultBreakMinutes)}
                  onChange={(e) => setBreakMinutes(iso, Math.max(0, Number(e.target.value)))}
                  className="w-16 rounded-md border border-gray-200 bg-transparent px-2 py-1 text-right text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
              <div className="flex items-center justify-end py-1 text-gray-400">{formatHM(target)}</div>
              <div
                className={`flex items-center justify-end py-1 font-medium ${
                  diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                {diff === 0 ? '–' : `${diff > 0 ? '+' : ''}${formatHM(diff)}`}
              </div>
            </Fragment>
          )
        })}

        <div className="col-span-5 mt-1 border-t border-gray-100 pt-2 dark:border-racing-800" />
        <div className="font-semibold">Woche gesamt</div>
        <div className="text-right font-semibold">{formatHM(weekNet)}</div>
        <div />
        <div className="text-right font-semibold text-gray-400">{formatHM(weekTarget)}</div>
        <div
          className={`text-right font-semibold ${
            weekNet - weekTarget > 0 ? 'text-emerald-500' : weekNet - weekTarget < 0 ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          {weekNet - weekTarget === 0 ? '–' : `${weekNet - weekTarget > 0 ? '+' : ''}${formatHM(weekNet - weekTarget)}`}
        </div>
      </div>
    </div>
  )
}
