import { Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { WEEKEND_COMP_DAY_THRESHOLD_MINUTES, computeOverview, formatHM } from '../../utils/worktime'

export default function OvertimeOverview() {
  const { t } = useTranslation('worktime')
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)
  const settledWeekendDays = useWorkTimeStore((s) => s.settledWeekendDays)
  const incrementSettledWeekendDays = useWorkTimeStore((s) => s.incrementSettledWeekendDays)
  const decrementSettledWeekendDays = useWorkTimeStore((s) => s.decrementSettledWeekendDays)

  const { totalDiffMinutes, totalDiffDays, weekendDaysWorked } = computeOverview(entries, settings)
  const positive = totalDiffMinutes >= 0
  const openWeekendDays = weekendDaysWorked - settledWeekendDays

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('overview.totalOvertime')}</p>
        <p className={`mt-1 text-3xl font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
          {positive ? '+' : ''}
          {formatHM(totalDiffMinutes)}
        </p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('overview.overtimeInDays')}</p>
        <p className={`mt-1 text-3xl font-bold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>
          {positive ? '+' : ''}
          {totalDiffDays.toFixed(1)}
        </p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('overview.compDays')}</p>
        <div className="mt-1 flex items-center gap-3">
          <button
            onClick={decrementSettledWeekendDays}
            disabled={settledWeekendDays <= 0}
            title={t('overview.undoCompDay')}
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
            title={t('overview.markCompDayTaken')}
            className="rounded-full border border-gray-200 p-1 text-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            <Plus size={16} />
          </button>
        </div>
        <p className="mt-1 text-center text-xs text-gray-400">
          {t('overview.earnedAndTaken', { earned: weekendDaysWorked, taken: settledWeekendDays })}
        </p>
        <p className="mt-2 text-center text-xs text-gray-400">
          {t('overview.thresholdInfo', { threshold: formatHM(WEEKEND_COMP_DAY_THRESHOLD_MINUTES) })}
        </p>
      </div>
    </div>
  )
}
