import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Play, Square, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { todayISO } from '../../utils/date'
import { dayTargetMinutes, formatHM, netMinutes } from '../../utils/worktime'

export default function WorkTimeWidget() {
  const { t } = useTranslation(['dashboard', 'worktime'])
  const isRunning = useWorkTimeStore((s) => s.isRunning)
  const runningStartedAt = useWorkTimeStore((s) => s.runningStartedAt)
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)
  const clockIn = useWorkTimeStore((s) => s.clockIn)
  const clockOut = useWorkTimeStore((s) => s.clockOut)

  const [, tick] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [isRunning])

  const today = todayISO()
  const entry = entries[today]
  const isSick = entry?.sickDay ?? false

  const liveMinutes = isRunning && runningStartedAt
    ? (Date.now() - new Date(runningStartedAt).getTime()) / 60000 : 0

  const net = netMinutes(entry) + liveMinutes
  const target = dayTargetMinutes(new Date(), settings)
  const diff = net - target
  const progress = target > 0 ? Math.min(100, (net / target) * 100) : 0

  const circumference = 2 * Math.PI * 26
  const dashOffset = circumference * (1 - progress / 100)

  return (
    <Link
      to="/arbeitszeit"
      className="group flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 hover:border-accent/30 hover:shadow-sm transition-all dark:border-racing-800 dark:bg-racing-900"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <Clock size={12} /> {t('officeWidget.todayLabel')}
        </span>
        {isRunning && (
          <span className="flex items-center gap-1 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" /> {t('officeWidget.running')}
          </span>
        )}
        {isSick && (
          <span className="text-xs font-medium text-amber-500">🤒 {t('officeWidget.sick')}</span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Ring progress */}
        <div className="relative flex-shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="26" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="5" />
            <circle
              cx="32" cy="32" r="26"
              fill="none"
              stroke={isSick ? '#f59e0b' : diff >= 0 ? '#10b981' : '#6366f1'}
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform="rotate(-90 32 32)"
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold tabular-nums leading-none">{formatHM(net)}</span>
            <span className="mb-0.5 text-xs text-gray-400">/ {formatHM(target)}</span>
          </div>
          <div className={`text-xs font-semibold ${diff >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
            {diff === 0 ? t('officeWidget.exactOnTarget') : `${diff > 0 ? '+' : ''}${formatHM(diff)} ${diff > 0 ? t('officeWidget.overtimeSuffix') : t('officeWidget.missingSuffix')}`}
          </div>
        </div>

        {/* Quick clock in/out */}
        {!isSick && (
          <button
            onClick={(e) => { e.preventDefault(); isRunning ? clockOut() : clockIn() }}
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white shadow ${
              isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-accent hover:bg-accent-dark'
            }`}
            title={isRunning ? t('officeWidget.stopwatchStop') : t('officeWidget.stopwatchStart')}
          >
            {isRunning ? <Square size={14} /> : <Play size={16} className="ml-0.5" />}
          </button>
        )}
      </div>

      {/* Week overview bar */}
      <div className="flex items-center gap-1">
        {[t('worktime:weekdays.mon'), t('worktime:weekdays.tue'), t('worktime:weekdays.wed'), t('worktime:weekdays.thu'), t('worktime:weekdays.fri')].map((label, i) => {
          const dayDate = new Date()
          const dow = dayDate.getDay() // 0=Sun
          const diffDays = i + 1 - (dow === 0 ? 7 : dow)
          const d = new Date(dayDate)
          d.setDate(d.getDate() + diffDays)
          const iso = d.toISOString().slice(0, 10)
          const e = entries[iso]
          const t2 = dayTargetMinutes(d, settings)
          const n2 = netMinutes(e) + (iso === today && isRunning ? liveMinutes : 0)
          const pct = t2 > 0 ? Math.min(100, (n2 / t2) * 100) : 0
          const isTod = iso === today
          const isSickD = e?.sickDay ?? false
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-0.5">
              <div className="relative h-8 w-full overflow-hidden rounded-sm bg-gray-100 dark:bg-racing-800">
                <div
                  className={`absolute bottom-0 w-full transition-all ${
                    isSickD ? 'bg-amber-300' : pct >= 100 ? 'bg-emerald-400' : isTod ? 'bg-accent/70' : 'bg-gray-300 dark:bg-racing-600'
                  }`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className={`text-[9px] font-medium ${isTod ? 'text-accent' : 'text-gray-400'}`}>{label}</span>
            </div>
          )
        })}
        <div className="flex flex-1 flex-col items-center gap-0.5">
          <div className="relative h-8 w-full overflow-hidden rounded-sm bg-gray-100 dark:bg-racing-800">
            <div className="absolute bottom-0 w-full bg-gray-200 dark:bg-racing-700" style={{ height: '0%' }} />
          </div>
          <span className="text-[9px] font-medium text-gray-300">{t('worktime:weekdays.sat')}</span>
        </div>
      </div>
    </Link>
  )
}
