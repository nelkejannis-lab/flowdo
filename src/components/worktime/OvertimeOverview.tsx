import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { WEEKEND_COMP_DAY_THRESHOLD_MINUTES, computeOverview, dailyTargetMinutes, formatHM } from '../../utils/worktime'
import { todayISO } from '../../utils/date'

export default function OvertimeOverview() {
  const { t } = useTranslation('worktime')
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)
  const settledWeekendDays = useWorkTimeStore((s) => s.settledWeekendDays)
  const incrementSettledWeekendDays = useWorkTimeStore((s) => s.incrementSettledWeekendDays)
  const decrementSettledWeekendDays = useWorkTimeStore((s) => s.decrementSettledWeekendDays)
  const compensationDays = useWorkTimeStore((s) => s.compensationDays)
  const isRunning = useWorkTimeStore((s) => s.isRunning)
  const runningStartedAt = useWorkTimeStore((s) => s.runningStartedAt)
  const runningDate = useWorkTimeStore((s) => s.runningDate)

  const [, tick] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [isRunning])

  // Build entries with live minutes included for today
  const liveMinutes =
    isRunning && runningStartedAt
      ? (Date.now() - new Date(runningStartedAt).getTime()) / 60000
      : 0

  const liveEntries = { ...entries }
  if (isRunning && runningDate) {
    const todayEntry = entries[runningDate] ?? { date: runningDate, workedMinutes: 0, breakMinutes: settings.defaultBreakMinutes }
    liveEntries[runningDate] = { ...todayEntry, workedMinutes: todayEntry.workedMinutes + liveMinutes }
  }

  const { totalDiffMinutes, totalDiffDays, weekendDaysWorked } = computeOverview(liveEntries, settings)

  // Each compensation day reduces overtime by one daily target
  const dailyTarget = dailyTargetMinutes(settings)
  const compensationMinutes = compensationDays.length * dailyTarget
  const adjustedDiffMinutes = totalDiffMinutes - compensationMinutes
  const adjustedDiffDays = dailyTarget > 0 ? adjustedDiffMinutes / dailyTarget : 0
  const positive = adjustedDiffMinutes >= 0
  const openWeekendDays = weekendDaysWorked - settledWeekendDays

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('overview.totalOvertime')}</p>
        <p className={`mt-1 text-3xl font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
          {positive ? '+' : ''}
          {formatHM(adjustedDiffMinutes)}
          {isRunning && <span className="ml-1 text-base animate-pulse">●</span>}
        </p>
        {compensationDays.length > 0 && (
          <p className="mt-1 text-xs text-gray-400">
            inkl. {compensationDays.length} Ausgleichstag{compensationDays.length !== 1 ? 'e' : ''}
            {' ('}−{formatHM(compensationMinutes)}{')'}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('overview.overtimeInDays')}</p>
        <p className={`mt-1 text-3xl font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
          {positive ? '+' : ''}
          {adjustedDiffDays.toFixed(1)}
        </p>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('overview.compDays')}</p>
        <div className="mt-1 flex items-center gap-3">
          <button
            onClick={decrementSettledWeekendDays}
            disabled={settledWeekendDays <= 0}
            className="rounded-full border border-gray-200 p-1 text-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            <Minus size={16} />
          </button>
          <div className="flex-1 text-center">
            <p className="text-3xl font-bold">{openWeekendDays}</p>
            <p className="text-xs text-gray-400">{t('overview.openCompDay', { count: openWeekendDays })}</p>
          </div>
          <button
            onClick={incrementSettledWeekendDays}
            disabled={settledWeekendDays >= weekendDaysWorked}
            className="rounded-full border border-gray-200 p-1 text-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            <Plus size={16} />
          </button>
        </div>
        <p className="mt-1 text-center text-xs text-gray-400">
          {t('overview.earnedAndTaken', { earned: weekendDaysWorked, taken: settledWeekendDays })}
        </p>
      </div>
    </div>
  )
}
