import { Fragment, useEffect, useState } from 'react'
import { addDays, addWeeks, eachDayOfInterval, format, isToday, startOfWeek } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Thermometer } from 'lucide-react'
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
  const markSickDay = useWorkTimeStore((s) => s.markSickDay)
  const unmarkSickDay = useWorkTimeStore((s) => s.unmarkSickDay)
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

      {/* Mobile card layout */}
      <div className="block sm:hidden divide-y divide-gray-100 dark:divide-racing-800">
        {days.map((day) => {
          const iso = toISODate(day)
          const entry = entries[iso]
          const target = dayTargetMinutes(day, settings)
          const isLive = isRunning && iso === runningDate
          const isSick = entry?.sickDay ?? false
          const net = netMinutes(entry) + (isLive ? liveMinutes : 0)
          const liveEndTime = isLive ? new Date().toTimeString().slice(0, 5) : null
          const diff = net - target
          return (
            <div key={iso} className={`p-3 ${isToday(day) ? 'bg-accent/5' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-semibold ${isToday(day) ? 'text-accent' : ''}`}>
                  {format(day, 'EEEE, d.MM.', { locale: dateLocale })}
                </span>
                {isSick ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Thermometer size={10} /> {t('sickDay.markSick')}
                  </span>
                ) : (
                  <span className={`text-xs font-semibold ${diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {(entry || isLive) ? `${diff > 0 ? '+' : ''}${formatHM(diff)}` : '–'}
                    {isLive && ' ●'}
                  </span>
                )}
              </div>
              {isSick ? (
                <button onClick={() => unmarkSickDay(iso)} className="text-[11px] text-gray-400 hover:text-red-500 underline">{t('sickDay.revoke')}</button>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">{t('week.columns.from')}</p>
                    <input type="time" value={entry?.startTime ?? ''} onChange={(e) => setDayTimes(iso, e.target.value, entry?.endTime ?? '')}
                      className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">{t('week.columns.to')}</p>
                    {isLive
                      ? <span className="block w-full px-1.5 py-1 text-sm font-medium text-accent animate-pulse">{liveEndTime} ●</span>
                      : <input type="time" value={entry?.endTime ?? ''} onChange={(e) => setDayTimes(iso, entry?.startTime ?? '', e.target.value)}
                          className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                    }
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 mb-0.5">{t('week.columns.break')} min</p>
                    <input type="number" min={0} step={5} value={entry ? entry.breakMinutes : ''} placeholder={String(settings.defaultBreakMinutes)}
                      onChange={(e) => setBreakMinutes(iso, Math.max(0, Number(e.target.value)))}
                      className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div className="flex items-center justify-between p-3 text-sm font-semibold">
          <span>{t('week.total')}</span>
          <span className={weekNet - weekTarget > 0 ? 'text-emerald-500' : weekNet - weekTarget < 0 ? 'text-red-500' : 'text-gray-400'}>
            {formatHM(weekNet)} / {formatHM(weekTarget)}
          </span>
        </div>
      </div>

      {/* Desktop table layout */}
      <div className="hidden sm:block overflow-x-auto -mx-1">
      <div className="grid grid-cols-[minmax(90px,1fr)_auto_auto_auto_auto_auto_auto] items-center gap-x-2 gap-y-1 p-3 text-sm min-w-[560px]">
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
          const isSick = entry?.sickDay ?? false
          const net = netMinutes(entry) + (isLive ? liveMinutes : 0)
          const liveEndTime = isLive ? new Date().toTimeString().slice(0, 5) : null
          const diff = net - target

          if (isSick) {
            return (
              <Fragment key={iso}>
                <div className={`flex items-center gap-2 py-1 ${isToday(day) ? 'font-semibold text-accent' : ''}`}>
                  {format(day, 'EEEE, d.MM.', { locale: dateLocale })}
                </div>
                <div className="col-span-4 flex items-center gap-1.5 py-1">
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    <Thermometer size={11} /> {t('sickDay.markSick')}
                  </span>
                  <button onClick={() => unmarkSickDay(iso)} className="text-[10px] text-gray-400 hover:text-red-500 underline">{t('sickDay.revoke')}</button>
                </div>
                <div className="flex items-center justify-end py-1 text-gray-400">{formatHM(target)}</div>
                <div className="flex items-center justify-end py-1 font-medium text-emerald-500">±0:00</div>
              </Fragment>
            )
          }

          return (
            <Fragment key={iso}>
              <div className={`flex items-center gap-2 py-1 ${isToday(day) ? 'font-semibold text-accent' : ''}`}>
                {format(day, 'EEEE, d.MM.', { locale: dateLocale })}
                {target > 0 && !entry && (
                  <button onClick={() => markSickDay(iso)} className="ml-auto text-[10px] text-gray-300 hover:text-amber-500" title="Als krank melden">
                    <Thermometer size={12} />
                  </button>
                )}
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
                className={`flex items-center justify-end gap-1 py-1 font-medium ${
                  diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-red-500' : 'text-gray-400'
                }`}
              >
                {isLive || diff !== 0 ? `${diff > 0 ? '+' : ''}${formatHM(diff)}` : '–'}
                {isLive && <span className="animate-pulse">●</span>}
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
      </div>{/* /hidden sm:block overflow-x-auto */}
    </div>
  )
}
