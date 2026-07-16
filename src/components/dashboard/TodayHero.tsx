import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import {
  CalendarDays,
  Flame,
  ArrowRight,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  PartyPopper,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { DonutChart, SegmentedBar, AvatarStack } from './FocusVisuals'
import type { DayReadinessResult, NextAction } from '../../lib/dayReadiness'

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
  readiness: DayReadinessResult
  openTodayCount: number
  onPlanDay?: () => void
  onOpenBriefing?: () => void
  onActionClick?: (action: NextAction) => void
}

const BAND_RING: Record<DayReadinessResult['band'], string> = {
  sharp: 'rgb(34 197 94)',
  ready: 'rgb(var(--accent))',
  stretched: 'rgb(245 158 11)',
  critical: 'rgb(239 68 68)',
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
  readiness,
  openTodayCount,
  onPlanDay,
  onOpenBriefing,
  onActionClick,
}: Props) {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const capped = Math.min(100, Math.max(0, capacityPercent))
  const free = Math.max(0, 100 - capped)
  const ring = BAND_RING[readiness.band]
  const scoreFree = Math.max(0, 100 - readiness.score)

  return (
    <section className="bento-card mb-6 overflow-hidden p-5 sm:p-7">
      {/* Hero header — screenshot test: what NOVAT is doing for you */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {t('readiness.eyebrow')}
          </p>
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
              className="rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-95 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
            >
              {t('focus.openBriefing')}
            </button>
          )}
          {onPlanDay && (
            <button
              type="button"
              onClick={onPlanDay}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-accent/20 transition hover:brightness-110 active:scale-95"
            >
              <Sparkles size={13} strokeWidth={1.8} />
              {t('focus.planDay')}
            </button>
          )}
        </div>
      </div>

      {/* Score + insight + next — primary above-the-fold composition */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Proprietary metric */}
        <div className="flex flex-col items-center gap-3 rounded-[20px] bg-gradient-to-br from-accent/[0.07] via-transparent to-transparent p-4 sm:p-5 lg:col-span-4 dark:from-accent/10">
          <DonutChart
            size={128}
            stroke={12}
            segments={[
              { value: Math.max(1, readiness.score), color: ring },
              { value: Math.max(0.5, scoreFree), color: 'rgba(148,163,184,0.22)' },
            ]}
            centerLabel={String(readiness.score)}
            centerSub={t('readiness.scoreShort')}
          />
          <div className="text-center">
            <p className="text-base font-semibold tracking-tight">
              {t(`readiness.band.${readiness.band}`)}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">{t('readiness.metricName')}</p>
            {readiness.streak > 0 && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <Zap size={11} />
                {t('readiness.streak', { count: readiness.streak })}
              </p>
            )}
          </div>
        </div>

        {/* Why + next actions */}
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {t('readiness.howYoureDoing')}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-700 dark:text-racing-100">
              {t(`readiness.why.${readiness.whyKey}`, readiness.whyParams)}
            </p>
            {readiness.factorKeys.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {readiness.factorKeys.map((key) => (
                  <li key={key} className="text-[11px] text-gray-400">
                    · {t(`readiness.factors.${key}`)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {t('readiness.whatNext')}
            </p>
            {readiness.todayDone || (openTodayCount === 0 && readiness.completedFocusToday > 0) ? (
              <DelightEmpty />
            ) : (
              <ul className="flex flex-col gap-2">
                {readiness.nextActions.map((action, i) => (
                  <li key={action.id}>
                    <button
                      type="button"
                      onClick={() => onActionClick?.(action)}
                      className="group flex w-full items-start gap-2.5 rounded-2xl bg-black/[0.03] px-3 py-2.5 text-left transition hover:bg-accent/10 active:scale-[0.99] dark:bg-white/[0.04]"
                    >
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/10 text-[10px] font-bold text-accent">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-sm font-medium leading-snug">
                          <ActionIcon kind={action.kind} />
                          {action.title || t(`readiness.next.${action.labelKey ?? 'planDay'}`)}
                        </span>
                        {action.kind === 'overdue' && (
                          <span className="mt-0.5 block text-[10px] font-semibold text-red-500">
                            {t('readiness.next.overdueTag')}
                          </span>
                        )}
                      </span>
                      <ArrowRight
                        size={14}
                        className="mt-1 shrink-0 text-gray-300 transition group-hover:text-accent"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Capacity pulse (refined living visual) */}
        <div className="flex flex-col justify-between gap-3 rounded-[18px] border border-black/[0.04] bg-white/60 p-4 dark:border-white/[0.06] dark:bg-racing-900/40 lg:col-span-3">
          <div className="flex items-center gap-3">
            <DonutChart
              size={72}
              stroke={8}
              segments={[
                { value: capped, color: 'rgb(var(--accent))' },
                { value: free, color: 'rgba(148,163,184,0.25)' },
              ]}
              centerLabel={`${Math.round(capped)}%`}
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {t('focus.capacityHint')}
              </p>
              <p className="mt-0.5 text-sm font-semibold tabular-nums">
                {workedLabel} <span className="font-normal text-gray-400">/ {targetLabel}</span>
              </p>
            </div>
          </div>
          <SegmentedBar value={capped} className="mt-1" />
          {colleagues.length > 0 && (
            <div className="flex items-center gap-2">
              <AvatarStack people={colleagues} />
              <span className="text-[11px] text-gray-400">
                {t('focus.teamActive', { count: colleagues.length })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Mobile story strip — swipeable insight cards */}
      <div className="mt-5 -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 lg:hidden scrollbar-none">
        <StoryCard
          label={t('focus.nextEvent')}
          icon={<CalendarDays size={14} className="text-accent" />}
        >
          {nextEvent ? (
            <>
              {nextEvent.startTime && (
                <p className="text-sm font-bold tabular-nums text-accent">{nextEvent.startTime}</p>
              )}
              <p className="text-sm font-semibold leading-snug">{nextEvent.title}</p>
              {nextEvent.date && (
                <p className="text-xs text-gray-400">
                  {format(parseISO(nextEvent.date), 'EEE, d. MMM', { locale: dateLocale })}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">{t('focus.noNextEvent')}</p>
          )}
          <Link to="/calendar" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent">
            {t('calendar')} <ArrowRight size={11} />
          </Link>
        </StoryCard>

        <StoryCard
          label={t('focus.topPriorities')}
          icon={<Flame size={14} className="text-red-500" />}
        >
          {priorities.length === 0 ? (
            <ClearPrioritiesEmpty />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {priorities.slice(0, 3).map((tk, i) => (
                <li key={tk.id} className="flex gap-2 text-sm font-medium">
                  <span className="text-accent">{i + 1}.</span>
                  <span className="line-clamp-2">{tk.title}</span>
                </li>
              ))}
            </ul>
          )}
        </StoryCard>

        <StoryCard label={t('readiness.metricName')} icon={<Zap size={14} className="text-amber-500" />}>
          <p className="text-2xl font-bold tabular-nums">{readiness.score}</p>
          <p className="text-sm text-gray-500">{t(`readiness.band.${readiness.band}`)}</p>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            {t(`readiness.why.${readiness.whyKey}`, readiness.whyParams)}
          </p>
        </StoryCard>
      </div>

      {/* Desktop secondary row — next event + priorities with breathing room */}
      <div className="mt-5 hidden gap-4 lg:grid lg:grid-cols-2">
        <div className="bento-card-sm flex flex-col gap-2 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {t('focus.nextEvent')}
          </span>
          {nextEvent ? (
            <>
              <div className="flex items-center gap-2 text-accent">
                <CalendarDays size={16} strokeWidth={1.6} />
                {nextEvent.startTime && (
                  <span className="text-sm font-bold tabular-nums">{nextEvent.startTime}</span>
                )}
              </div>
              <p className="text-base font-semibold leading-snug">{nextEvent.title}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">{t('focus.noNextEvent')}</p>
          )}
          <Link
            to="/calendar"
            className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-semibold text-accent hover:underline"
          >
            {t('calendar')} <ArrowRight size={12} />
          </Link>
        </div>

        <div className="bento-card-sm flex flex-col gap-2 p-4">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <Flame size={11} className="text-red-500" /> {t('focus.topPriorities')}
          </span>
          {priorities.length === 0 ? (
            <ClearPrioritiesEmpty />
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
          <Link
            to="/eisenhower"
            className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-semibold text-accent hover:underline"
          >
            {t('sections.manageEisenhower')} <ArrowRight size={12} />
          </Link>
        </div>
      </div>
    </section>
  )
}

function StoryCard({
  label,
  icon,
  children,
}: {
  label: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="bento-card-sm w-[78vw] max-w-[280px] shrink-0 snap-center p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {icon}
        {label}
      </p>
      {children}
    </div>
  )
}

function ActionIcon({ kind }: { kind: NextAction['kind'] }) {
  if (kind === 'overdue') return <AlertTriangle size={13} className="text-red-500" />
  if (kind === 'event') return <CalendarDays size={13} className="text-accent" />
  if (kind === 'status') return <MapPin size={13} className="text-sky-500" />
  if (kind === 'celebrate') return <PartyPopper size={13} className="text-amber-500" />
  if (kind === 'plan') return <Sparkles size={13} className="text-violet-500" />
  return <CheckCircle2 size={13} className="text-accent" />
}

function DelightEmpty() {
  const { t } = useTranslation('dashboard')
  return (
    <div className="readiness-delight flex flex-col items-center gap-2 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-accent/5 px-4 py-6 text-center">
      <PartyPopper size={28} className="text-emerald-500 readiness-pop" />
      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
        {t('readiness.delight.title')}
      </p>
      <p className="text-xs text-gray-500 dark:text-racing-300">{t('readiness.delight.body')}</p>
    </div>
  )
}

function ClearPrioritiesEmpty() {
  const { t } = useTranslation('dashboard')
  return (
    <div className="flex flex-col items-start gap-1 py-1">
      <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={15} />
        {t('readiness.delight.noQ1')}
      </p>
      <p className="text-xs text-gray-400">{t('readiness.delight.noQ1Hint')}</p>
    </div>
  )
}
