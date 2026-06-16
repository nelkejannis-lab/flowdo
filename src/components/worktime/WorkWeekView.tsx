import { Fragment, useEffect, useState } from 'react'
import { addDays, addWeeks, eachDayOfInterval, format, isToday, startOfWeek } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { toISODate } from '../../utils/date'
import { dayTargetMinutes, formatHM, netMinutes } from '../../utils/worktime'

export default function WorkWeekView() {
  const { t, i18n } = useTranslation('worktime')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }))
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)
  const setBreakMinutes = useWorkTimeStore((s) => s.setBreakMinutes)
  const setDayTimes = useWorkTimeStore((s) => s.setDayTimes)
  const isRunning = useWorkTimeStore((s) => s.isRunning)
  const runningStartedAt = useWorkTimeStore((s) => s.runningStartedAt)
  const runningDate = useWorkTimeStore((s) => s.runningDate)

  const [, tick] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [isRunning])

  const liveMinutes =
    isRunning && runningStartedAt
      ? (Date.now() - new Date(runningStartedAt).getTime()) / 60000
      : 0

  const days = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) })

  const weekNet = days.reduce((sum, day) => {
    const iso = toISODate(day)
    const base = netMinutes(entries[iso])
    return sum + (iso === runningDate ? base + liveMinutes : base)
  }, 0)
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
          {format(weekStart, 'd. MMM', { locale: dateLocale })} – {format(addDays(weekStart, 6), 'd. MMM yyyy', { locale: dateLocale })}
        </span>
        <button
          onClick={() => setWeekStart((d) => addWeeks(d, 1))}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] items-center gap-x-3 gap-y-1 p-3 text-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t('week.columns.day')}</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">{t('week.columns.from')}</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">{t('week.columns.to')}</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">{t('week.columns.break')}</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">{t('week.columns.worked')}</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">{t('week.columns.target')}</div>
        <div className="text-right text-xs font-semibold uppercase tracking-wide text-gray-400">{t('week.columns.diff')}</div>

        {days.map((day) => {
          const iso = toISODate(day)
          const entry = entries[iso]
          const target = dayTargetMinutes(day, settings)
          const isLive = isRunning && iso === runningDate
          const net = netMinutes(entry) + (isLive ? liveMinutes : 0)
          const liveEndTime = isLive ? new Date().toTimeString().slice(0, 5) : null
          const diff = net - target

          return (
            <Fragment key={iso}>
              <div className={`flex items-center gap-2 py-1 ${isToday(day) ? 'font-semibold text-accent' : ''}`}>
                {format(day, 'EEEE, d.MM.', { locale: dateLocale })}
              </div>
              <div className="flex items-center justify-end py-1">
                <input
                  type="time"
                  value={entry?.startTime ?? ''}
                  onChange={(e) => setDayTimes(iso, e.target.value, entry?.endTime ?? '')}
                  className="w-24 rounded-md border border-gray-200 bg-transparent px-2 py-1 text-right text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
              <div className="flex items-center justify-end py-1">
                {isLive ? (
                  <span className="w-24 px-2 py-1 text-right text-sm font-medium text-accent animate-pulse">
                    {liveEndTime} ●
                  </span>
                ) : (
                  <input
                    type="time"
                    value={entry?.endTime ?? ''}
                    onChange={(e) => setDayTimes(iso, entry?.startTime ?? '', e.target.value)}
                    className="w-24 rounded-md border border-gray-200 bg-transparent px-2 py-1 text-right text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                  />
                )}
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
              <div className="flex items-center justify-end gap-1 py-1 font-medium">
                {(entry || isLive) ? formatHM(net) : '–'}
                {isLive && <span className="text-accent animate-pulse">●</span>}
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

        <div className="col-span-7 mt-1 border-t border-gray-100 pt-2 dark:border-racing-800" />
        <div className="font-semibold">{t('week.total')}</div>
        <div />
        <div />
        <div />
        <div className="text-right font-semibold">{formatHM(weekNet)}</div>
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
