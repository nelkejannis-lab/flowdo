import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format, addDays, startOfWeek, isSameDay } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { DonutChart, SegmentedBar } from './FocusVisuals'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { dayTargetMinutes, formatHM, netMinutes } from '../../utils/worktime'
import { todayISO } from '../../utils/date'
import type { Task, CalendarEntry } from '../../types'

interface CapacityProps {
  openTaskCount: number
  meetingMinutes: number
}

export function DayCapacityWidget({ openTaskCount, meetingMinutes }: CapacityProps) {
  const { t } = useTranslation('dashboard')
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)
  const isRunning = useWorkTimeStore((s) => s.isRunning)
  const runningStartedAt = useWorkTimeStore((s) => s.runningStartedAt)

  const today = todayISO()
  const entry = entries[today]
  const live = isRunning && runningStartedAt ? (Date.now() - new Date(runningStartedAt).getTime()) / 60000 : 0
  const worked = netMinutes(entry) + live
  const target = dayTargetMinutes(new Date(), settings)
  const pct = target > 0 ? Math.min(100, (worked / target) * 100) : 0
  const taskLoad = Math.min(40, openTaskCount * 6)
  const meetingLoad = Math.min(40, (meetingMinutes / Math.max(target, 1)) * 100)
  const free = Math.max(0, 100 - pct)

  return (
    <div className="bento-card flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t('focus.dayCapacity')}</h3>
          <p className="mt-0.5 text-xs text-gray-400">{t('focus.dayCapacitySub')}</p>
        </div>
        <Link to="/arbeitszeit" className="text-xs font-semibold text-accent hover:underline">
          {t('focus.details')}
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <DonutChart
          size={112}
          stroke={11}
          segments={[
            { value: Math.max(1, pct), color: 'rgb(var(--accent))' },
            { value: Math.max(0.5, meetingLoad), color: 'rgb(167 139 250)' },
            { value: Math.max(0.5, taskLoad), color: 'rgb(100 116 139)' },
            { value: Math.max(1, free), color: 'rgba(148,163,184,0.2)' },
          ]}
          centerLabel={formatHM(worked)}
          centerSub={t('focus.worked')}
        />
        <div className="flex flex-1 flex-col gap-3 text-xs">
          <LegendDot color="rgb(var(--accent))" label={t('focus.legendWorked')} value={formatHM(worked)} />
          <LegendDot color="rgb(167 139 250)" label={t('focus.legendMeetings')} value={`${Math.round(meetingMinutes)} min`} />
          <LegendDot color="rgb(100 116 139)" label={t('focus.legendOpenTasks')} value={String(openTaskCount)} />
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('focus.load')}</p>
            <SegmentedBar value={pct} />
          </div>
        </div>
      </div>
      <p className="mt-auto text-[11px] leading-relaxed text-gray-400">
        {pct >= 90
          ? t('focus.insightFull')
          : pct >= 50
            ? t('focus.insightBalanced')
            : t('focus.insightLight')}
      </p>
    </div>
  )
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-gray-600 dark:text-racing-200">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="font-semibold tabular-nums text-gray-800 dark:text-white">{value}</span>
    </div>
  )
}

interface WeekProps {
  tasks: Task[]
  entries: CalendarEntry[]
}

export function WeekOverviewWidget({ tasks, entries }: WeekProps) {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de

  const days = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(start, i)
      const iso = format(d, 'yyyy-MM-dd')
      const taskCount = tasks.filter((tk) => !tk.completed && tk.dueDate === iso).length
      const entryCount = entries.filter((e) => {
        if (e.date === iso) return true
        if (e.endDate && e.date < iso && e.endDate >= iso) return true
        return false
      }).length
      return {
        date: d,
        iso,
        label: format(d, 'EEEEE', { locale: dateLocale }),
        taskCount,
        entryCount,
        total: taskCount + entryCount,
        isToday: isSameDay(d, new Date()),
      }
    })
  }, [tasks, entries, dateLocale])

  const max = Math.max(1, ...days.map((d) => d.total))

  return (
    <div className="bento-card flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{t('focus.weekOverview')}</h3>
          <p className="mt-0.5 text-xs text-gray-400">{t('focus.weekOverviewSub')}</p>
        </div>
        <Link to="/tasks/week" className="text-xs font-semibold text-accent hover:underline">
          {t('showAll')}
        </Link>
      </div>
      <div className="flex flex-1 items-end gap-2 pt-2">
        {days.map((d) => {
          const h = Math.max(8, (d.total / max) * 88)
          return (
            <div key={d.iso} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold tabular-nums text-gray-500">{d.total || ''}</span>
              <div
                className={`w-full max-w-[28px] rounded-t-lg transition-all ${
                  d.isToday ? 'bg-accent' : 'bg-accent/25 dark:bg-accent/35'
                }`}
                style={{ height: h }}
                title={`${format(d.date, 'EEE d.M.', { locale: dateLocale })}: ${d.taskCount} ${t('focus.tasksShort')}, ${d.entryCount} ${t('focus.eventsShort')}`}
              />
              <span className={`text-[10px] font-semibold ${d.isToday ? 'text-accent' : 'text-gray-400'}`}>{d.label}</span>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-gray-400">
        {(() => {
          const peak = [...days].sort((a, b) => b.total - a.total)[0]
          if (!peak || peak.total === 0) return t('focus.insightWeekEmpty')
          return t('focus.insightWeekPeak', { day: format(peak.date, 'EEEE', { locale: dateLocale }) })
        })()}
      </p>
    </div>
  )
}
