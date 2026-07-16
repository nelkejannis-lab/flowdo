import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Flame, ArrowRight, Sparkles } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { DonutChart, SegmentedBar, AvatarStack } from './FocusVisuals'

interface PriorityTask {
  id: string
  title: string
  priority: string
}

interface NextEvent {
  id: string
  title: string
  startTime?: string
  date?: string
}

interface Colleague {
  id: string
  name: string
  avatarUrl?: string
  color?: string
}

interface Props {
  dayLabel: string
  nextEvent?: NextEvent | null
  priorities: PriorityTask[]
  capacityPercent: number
  workedLabel: string
  targetLabel: string
  workStatus?: string | null
  colleagues?: Colleague[]
  onPlanDay?: () => void
  onOpenBriefing?: () => void
}

export default function TodayHero({
  dayLabel,
  nextEvent,
  priorities,
  capacityPercent,
  workedLabel,
  targetLabel,
  workStatus,
  colleagues = [],
  onPlanDay,
  onOpenBriefing,
}: Props) {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const capped = Math.min(100, Math.max(0, capacityPercent))
  const free = Math.max(0, 100 - capped)

  return (
    <section className="bento-card mb-6 overflow-hidden p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">{t('focus.today')}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{dayLabel}</h1>
          {workStatus && (
            <p className="mt-1.5 text-sm text-gray-500 dark:text-racing-300">{workStatus}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenBriefing && (
            <button
              type="button"
              onClick={onOpenBriefing}
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
            >
              {t('focus.openBriefing')}
            </button>
          )}
          {onPlanDay && (
            <button
              type="button"
              onClick={onPlanDay}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-accent/20 hover:brightness-110"
            >
              <Sparkles size={13} strokeWidth={1.8} />
              {t('focus.planDay')}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Next event */}
        <div className="bento-card-sm flex flex-col gap-2 p-4 lg:col-span-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('focus.nextEvent')}</span>
          {nextEvent ? (
            <>
              <div className="flex items-center gap-2 text-accent">
                <CalendarDays size={16} strokeWidth={1.6} />
                {nextEvent.startTime && (
                  <span className="text-sm font-bold tabular-nums">{nextEvent.startTime}</span>
                )}
              </div>
              <p className="text-base font-semibold leading-snug">{nextEvent.title}</p>
              {nextEvent.date && (
                <p className="text-xs text-gray-400">
                  {format(parseISO(nextEvent.date), 'EEE, d. MMM', { locale: dateLocale })}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">{t('focus.noNextEvent')}</p>
          )}
          <Link to="/calendar" className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-semibold text-accent hover:underline">
            {t('calendar')} <ArrowRight size={12} />
          </Link>
        </div>

        {/* Top priorities */}
        <div className="bento-card-sm flex flex-col gap-2 p-4 lg:col-span-4">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <Flame size={11} className="text-red-500" /> {t('focus.topPriorities')}
          </span>
          {priorities.length === 0 ? (
            <p className="text-sm text-gray-400">{t('sections.noTopPriority')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {priorities.slice(0, 3).map((tk, i) => (
                <li key={tk.id} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium leading-snug">{tk.title}</span>
                </li>
              ))}
            </ul>
          )}
          <Link to="/eisenhower" className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-semibold text-accent hover:underline">
            {t('sections.manageEisenhower')} <ArrowRight size={12} />
          </Link>
        </div>

        {/* Capacity */}
        <div className="bento-card-sm flex items-center gap-4 p-4 lg:col-span-4">
          <DonutChart
            size={96}
            stroke={10}
            segments={[
              { value: capped, color: 'rgb(var(--accent))' },
              { value: free, color: 'rgba(148,163,184,0.25)' },
            ]}
            centerLabel={`${Math.round(capped)}%`}
            centerSub={t('focus.capacity')}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{t('focus.capacityHint')}</p>
            <p className="mt-1 text-sm font-semibold">
              {workedLabel} <span className="font-normal text-gray-400">/ {targetLabel}</span>
            </p>
            <SegmentedBar value={capped} className="mt-3" />
            {colleagues.length > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <AvatarStack people={colleagues} />
                <span className="text-[11px] text-gray-400">{t('focus.teamActive', { count: colleagues.length })}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
