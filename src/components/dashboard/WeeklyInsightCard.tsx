import { useTranslation } from 'react-i18next'
import { Trophy, TrendingUp, RefreshCw, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import type { WeeklyInsight } from '../../lib/dayReadiness'
import { SegmentedBar } from './FocusVisuals'

interface Props {
  insight: WeeklyInsight
  onAiRefresh?: () => void
  aiLoading?: boolean
}

export default function WeeklyInsightCard({ insight, onAiRefresh, aiLoading }: Props) {
  const { t } = useTranslation('dashboard')

  return (
    <section className="bento-card flex flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            {t('readiness.week.eyebrow')}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight">
            {t(`readiness.week.${insight.headlineKey}`)}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-500 dark:text-racing-300">
            {t(`readiness.week.${insight.bodyKey}`, insight.bodyParams)}
          </p>
        </div>
        {onAiRefresh && (
          <button
            type="button"
            onClick={onAiRefresh}
            disabled={aiLoading}
            title={t('readiness.week.aiRefresh')}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-200"
          >
            {aiLoading ? (
              <RefreshCw size={12} className="animate-spin" />
            ) : (
              <Sparkles size={12} className="text-violet-500" />
            )}
            {t('readiness.week.aiRefresh')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          icon={<Trophy size={14} className="text-amber-500" />}
          label={t('readiness.week.done')}
          value={
            insight.completedCount + insight.openRemaining > 0
              ? t('progressPills.tasksRatio', {
                  done: insight.completedCount,
                  total: insight.completedCount + insight.openRemaining,
                })
              : String(insight.completedCount)
          }
        />
        <Stat
          icon={<TrendingUp size={14} className="text-accent" />}
          label={t('readiness.week.focusWins')}
          value={String(insight.completedFocusCount)}
        />
        <Stat
          label={t('readiness.week.remaining')}
          value={String(insight.openRemaining)}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="font-semibold uppercase tracking-wider text-gray-400">
            {t('readiness.week.progress')}
          </span>
          <span className="font-bold tabular-nums text-gray-700 dark:text-racing-100">
            {insight.progressPercent}%
          </span>
        </div>
        <SegmentedBar value={insight.progressPercent} segments={14} />
      </div>

      {insight.winTitles.length > 0 && (
        <div className="rounded-2xl bg-black/[0.03] px-3.5 py-3 dark:bg-white/[0.04]">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {t('readiness.week.wins')}
          </p>
          <ul className="flex flex-col gap-1">
            {insight.winTitles.map((title) => (
              <li key={title} className="truncate text-sm font-medium text-gray-700 dark:text-racing-100">
                · {title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon?: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="bento-card-sm px-3 py-2.5">
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums leading-none sm:text-2xl">{value}</p>
    </div>
  )
}
