import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Play, Square, Thermometer, Coffee, Cigarette, GlassWater, Pause } from 'lucide-react'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { todayISO } from '../../utils/date'
import { dayTargetMinutes, formatHM, netMinutes } from '../../utils/worktime'

const BREAK_TYPES = [
  { id: 'pause', labelKey: 'break.types.break', icon: Coffee },
  { id: 'rauchen', labelKey: 'break.types.smoke', icon: Cigarette },
  { id: 'trinken', labelKey: 'break.types.drink', icon: GlassWater },
]

export default function TimeClock() {
  const { t } = useTranslation('worktime')
  const isRunning = useWorkTimeStore((s) => s.isRunning)
  const runningStartedAt = useWorkTimeStore((s) => s.runningStartedAt)
  const isOnBreak = useWorkTimeStore((s) => s.isOnBreak)
  const breakStartedAt = useWorkTimeStore((s) => s.breakStartedAt)
  const breakType = useWorkTimeStore((s) => s.breakType)
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)
  const clockIn = useWorkTimeStore((s) => s.clockIn)
  const clockOut = useWorkTimeStore((s) => s.clockOut)
  const startBreak = useWorkTimeStore((s) => s.startBreak)
  const endBreak = useWorkTimeStore((s) => s.endBreak)
  const setBreakMinutes = useWorkTimeStore((s) => s.setBreakMinutes)
  const markSickDay = useWorkTimeStore((s) => s.markSickDay)
  const unmarkSickDay = useWorkTimeStore((s) => s.unmarkSickDay)

  const [showBreakMenu, setShowBreakMenu] = useState(false)

  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [isRunning])

  const today = todayISO()
  const entry = entries[today] ?? { date: today, workedMinutes: 0, breakMinutes: settings.defaultBreakMinutes }
  const isSick = entry.sickDay ?? false

  // While on break the work clock freezes at the moment the break started.
  const liveAnchor = isOnBreak && breakStartedAt ? new Date(breakStartedAt).getTime() : Date.now()
  const liveMinutes =
    isRunning && runningStartedAt ? (liveAnchor - new Date(runningStartedAt).getTime()) / 60000 : 0
  const breakElapsedSec = isOnBreak && breakStartedAt ? Math.floor((Date.now() - new Date(breakStartedAt).getTime()) / 1000) : 0

  const totalWorkedMinutes = entry.workedMinutes + liveMinutes
  const net = Math.max(0, totalWorkedMinutes - entry.breakMinutes)
  const target = dayTargetMinutes(new Date(), settings)
  const diff = net - target

  const liveSeconds = Math.floor(liveMinutes * 60)
  const liveH = Math.floor(liveSeconds / 3600)
  const liveM = Math.floor((liveSeconds % 3600) / 60)
  const liveS = liveSeconds % 60

  if (isSick) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="flex flex-col items-center gap-2">
          <Thermometer size={36} className="text-amber-500" />
          <span className="text-lg font-bold text-amber-700 dark:text-amber-300">{t('sickDay.title')}</span>
          <span className="text-xs text-amber-600 dark:text-amber-400">{t('sickDay.noteEntered')}</span>
        </div>
        <button
          onClick={() => unmarkSickDay(today)}
          className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/40"
        >
          {t('sickDay.revoke')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-100 bg-white p-6 dark:border-racing-800 dark:bg-racing-900">
      <div className="flex flex-col items-center">
        <span className={`text-4xl font-bold tabular-nums ${isOnBreak ? 'text-amber-500' : ''}`}>
          {isRunning
            ? `${String(liveH).padStart(2, '0')}:${String(liveM).padStart(2, '0')}:${String(liveS).padStart(2, '0')}`
            : formatHM(net)}
        </span>
        <span className="mt-1 text-xs text-gray-400">
          {isOnBreak ? t('break.paused') : isRunning ? t('clock.running') : t('clock.workedToday')}
        </span>
      </div>

      {/* Break banner */}
      {isOnBreak && (
        <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
            {t('break.onBreak', { type: t(BREAK_TYPES.find((b) => b.id === breakType)?.labelKey ?? 'break.types.break') })} · {String(Math.floor(breakElapsedSec / 60)).padStart(2, '0')}:{String(breakElapsedSec % 60).padStart(2, '0')}
          </span>
          <button
            onClick={endBreak}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            <Play size={14} /> {t('break.resume')}
          </button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={isRunning ? clockOut : clockIn}
          className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ${
            isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-accent hover:bg-accent-dark'
          }`}
          title={isRunning ? t('clock.clockOut') : t('clock.clockIn')}
        >
          {isRunning ? <Square size={20} /> : <Play size={22} className="ml-0.5" />}
        </button>

        {/* Pause button with break-type picker, only while working and not already on break */}
        {isRunning && !isOnBreak && (
          <div className="relative">
            <button
              onClick={() => setShowBreakMenu((v) => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
              title={t('break.start')}
            >
              <Pause size={16} /> {t('break.label')}
            </button>
            {showBreakMenu && (
              <div className="absolute left-1/2 top-full z-20 mt-2 flex -translate-x-1/2 flex-col gap-1 rounded-xl border border-gray-100 bg-white p-1.5 shadow-lg dark:border-racing-700 dark:bg-racing-900">
                {BREAK_TYPES.map((b) => {
                  const Icon = b.icon
                  return (
                    <button
                      key={b.id}
                      onClick={() => { startBreak(b.id); setShowBreakMenu(false) }}
                      className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-racing-200 dark:hover:bg-racing-800"
                    >
                      <Icon size={15} /> {t(b.labelKey)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!isRunning && (
          <button
            onClick={() => markSickDay(today)}
            className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
            title={t('sickDay.markSickTitle')}
          >
            <Thermometer size={16} /> {t('sickDay.markSick')}
          </button>
        )}
      </div>

      <div className="grid w-full grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
          <p className="text-xs text-gray-400">{t('clock.targetToday')}</p>
          <p className="font-semibold">{formatHM(target)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
          <p className="text-xs text-gray-400">{t('clock.difference')}</p>
          <p className={`font-semibold ${diff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
            {diff >= 0 ? '+' : ''}
            {formatHM(diff)}
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-racing-800">
        <label htmlFor="break-minutes" className="text-gray-500 dark:text-racing-200">
          {t('clock.breakMinutes')}
        </label>
        <input
          id="break-minutes"
          type="number"
          min={0}
          step={5}
          value={entry.breakMinutes}
          onChange={(e) => setBreakMinutes(today, Math.max(0, Number(e.target.value)))}
          className="w-16 rounded-md border border-gray-200 bg-transparent px-2 py-1 text-right text-sm focus:border-accent focus:outline-none dark:border-racing-700"
        />
      </div>

      <p className="text-xs text-gray-400">
        {netMinutes(entry) > 0 ? t('clock.alreadyTracked', { time: formatHM(netMinutes(entry)) }) : t('clock.nothingTracked')}
      </p>
    </div>
  )
}
