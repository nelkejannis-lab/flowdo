import { Link } from 'react-router-dom'
import { format, isMonday } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { X, Sun, CalendarDays, CheckSquare, Sparkles, Clock, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SegmentedBar, AvatarStack, DonutChart } from './FocusVisuals'

interface Task {
  id: string
  title: string
  priority: string
  dueDate?: string
}

interface Entry {
  id: string
  title: string
  startTime?: string
  type: string
}

interface Colleague {
  id: string
  name: string
  avatarUrl?: string
  color?: string
}

interface Props {
  todayTasks: Task[]
  weekTasks: Task[]
  todayEntries: Entry[]
  weekEntries: Entry[]
  capacityPercent?: number
  workedLabel?: string
  targetLabel?: string
  colleagues?: Colleague[]
  onClose: () => void
  onPlanDay?: () => void
  onPrioritize?: () => void
}

const priorityDot: Record<string, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-sky-400',
}

export default function MorningReportModal({
  todayTasks,
  weekTasks,
  todayEntries,
  weekEntries,
  capacityPercent = 0,
  workedLabel,
  targetLabel,
  colleagues = [],
  onClose,
  onPlanDay,
  onPrioritize,
}: Props) {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const isWeekly = isMonday(new Date())
  const hour = new Date().getHours()
  const dayLabel = format(new Date(), 'EEEE, d. MMMM', { locale: dateLocale })
  const greeting =
    hour < 10
      ? t('morningReport.greetingMorning')
      : hour < 13
        ? t('morningReport.greetingMidday')
        : t('morningReport.greetingAfternoon')

  const topTasks = todayTasks.slice(0, 5)
  const agenda = todayEntries.slice(0, 5)
  const capped = Math.min(100, Math.max(0, capacityPercent))
  const loadScore = Math.min(100, todayTasks.length * 12 + todayEntries.length * 15)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-[3px] sm:items-center sm:p-6">
      <div className="bento-card relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        {/* Header */}
        <div className="relative overflow-hidden px-5 pb-4 pt-5 sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/15 via-transparent to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-gray-400 hover:bg-black/[0.05] hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={t('morningReport.close')}
          >
            <X size={16} strokeWidth={1.6} />
          </button>
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
              <Sun size={22} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1 pr-8">
              <p className="text-sm font-medium text-gray-500 dark:text-racing-300">{greeting}</p>
              <h2 className="text-xl font-semibold tracking-tight">
                {isWeekly ? t('morningReport.weekly') : t('morningReport.daily')}
              </h2>
              <p className="mt-0.5 text-xs text-gray-400">{dayLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-2 sm:px-6">
          {/* Capacity strip */}
          <div className="bento-card-sm flex items-center gap-4 p-3.5">
            <DonutChart
              size={72}
              stroke={8}
              segments={[
                { value: Math.max(1, capped), color: 'rgb(var(--accent))' },
                { value: Math.max(1, 100 - capped), color: 'rgba(148,163,184,0.22)' },
              ]}
              centerLabel={`${Math.round(capped)}%`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {t('morningReport.capacity')}
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                {workedLabel ?? '—'}
                {targetLabel ? <span className="font-normal text-gray-400"> / {targetLabel}</span> : null}
              </p>
              <SegmentedBar value={loadScore} className="mt-2" segments={10} />
              <p className="mt-1.5 text-[11px] text-gray-400">
                {t('morningReport.workloadHint', { tasks: todayTasks.length, events: todayEntries.length })}
              </p>
            </div>
          </div>

          {/* Agenda */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              <CalendarDays size={12} strokeWidth={1.6} /> {t('morningReport.todayAppointments')}
            </h3>
            {agenda.length === 0 ? (
              <p className="rounded-2xl bg-black/[0.03] px-3 py-3 text-sm text-gray-400 dark:bg-white/[0.04]">
                {t('morningReport.noAppointments')}
              </p>
            ) : (
              <div className="space-y-1.5">
                {agenda.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-2xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]"
                  >
                    {e.startTime ? (
                      <span className="w-11 flex-shrink-0 text-xs font-bold tabular-nums text-accent">{e.startTime}</span>
                    ) : (
                      <Clock size={14} className="flex-shrink-0 text-gray-400" strokeWidth={1.6} />
                    )}
                    <span className="truncate text-sm font-medium">{e.title}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Priorities */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              <CheckSquare size={12} strokeWidth={1.6} /> {t('morningReport.todayDue')}
            </h3>
            {topTasks.length === 0 ? (
              <p className="rounded-2xl bg-black/[0.03] px-3 py-3 text-sm text-gray-400 dark:bg-white/[0.04]">
                {t('morningReport.noTasks')}
              </p>
            ) : (
              <div className="space-y-1.5">
                {topTasks.map((tk) => (
                  <div
                    key={tk.id}
                    className="flex items-center gap-3 rounded-2xl bg-black/[0.03] px-3 py-2.5 dark:bg-white/[0.04]"
                  >
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${priorityDot[tk.priority] ?? 'bg-gray-400'}`} />
                    <span className="truncate text-sm font-medium">{tk.title}</span>
                  </div>
                ))}
                {todayTasks.length > 5 && (
                  <p className="pl-3 text-xs text-gray-400">+{todayTasks.length - 5}</p>
                )}
              </div>
            )}
          </section>

          {/* Weekly extras */}
          {isWeekly && (weekEntries.length > 0 || weekTasks.length > 0) && (
            <section className="rounded-2xl border border-dashed border-gray-200 p-3 dark:border-racing-700">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {t('morningReport.weekGlance')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-racing-200">
                {t('morningReport.weekSummary', {
                  events: weekEntries.length,
                  tasks: weekTasks.length,
                })}
              </p>
            </section>
          )}

          {/* Team presence */}
          {colleagues.length > 0 && (
            <section className="flex items-center justify-between gap-3 rounded-2xl bg-accent/[0.06] px-3 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {t('morningReport.teamToday')}
                </p>
                <p className="text-sm font-medium">{t('focus.teamActive', { count: colleagues.length })}</p>
              </div>
              <AvatarStack people={colleagues} max={5} />
            </section>
          )}

          {todayTasks.length === 0 && todayEntries.length === 0 && !isWeekly && (
            <p className="py-2 text-center text-sm text-gray-400">{t('morningReport.emptyDay')}</p>
          )}
        </div>

        {/* Quick actions */}
        <div className="border-t border-black/[0.05] p-4 dark:border-white/[0.06] sm:p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {onPrioritize && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onPrioritize()
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/25 hover:brightness-110"
              >
                <CheckSquare size={15} strokeWidth={1.6} />
                {t('morningReport.actionPrioritize')}
              </button>
            )}
            {onPlanDay && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onPlanDay()
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
              >
                <Sparkles size={15} strokeWidth={1.6} />
                {t('morningReport.actionPlan')}
              </button>
            )}
            <Link
              to="/calendar"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
            >
              <CalendarDays size={15} strokeWidth={1.6} />
              {t('morningReport.actionCalendar')}
            </Link>
          </div>
          <div className="flex gap-2">
            <Link
              to="/arbeitszeit"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              {t('morningReport.actionWork')} <ArrowRight size={12} />
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full bg-black/[0.04] py-2 text-sm font-semibold text-gray-700 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-racing-100 dark:hover:bg-white/[0.1]"
            >
              {t('morningReport.letsGo')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
