import { useTranslation } from 'react-i18next'
import type { PostInsight } from '../../lib/socialInsights'

interface Props {
  insight: PostInsight
}

export default function PostInsightAnalysis({ insight }: Props) {
  const { t } = useTranslation('social')

  return (
    <div className="space-y-4">
      {insight.strengths.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            {t('postInsight.strengthsTitle')}
          </p>
          <ul className="mt-1.5 space-y-1">
            {insight.strengths.map((s) => (
              <li key={s} className="flex gap-2 text-sm text-gray-700 dark:text-racing-200">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {insight.improvements.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            {t('postInsight.improvementsTitle')}
          </p>
          <ul className="mt-1.5 space-y-1">
            {insight.improvements.map((s) => (
              <li key={s} className="flex gap-2 text-sm text-gray-700 dark:text-racing-200">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {insight.performanceTips.length > 0 && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">
            {t('postInsight.performanceTipsTitle')}
          </p>
          <ul className="mt-1.5 space-y-1">
            {insight.performanceTips.map((s) => (
              <li key={s} className="flex gap-2 text-sm text-gray-700 dark:text-racing-200">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2.5">
        <span
          className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
            insight.tone === 'action'
              ? 'bg-amber-500'
              : insight.tone === 'positive'
                ? 'bg-emerald-500'
                : 'bg-accent/60'
          }`}
        />
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {t('postInsight.summaryTitle')}
          </p>
          <p className="mt-0.5 text-sm leading-relaxed text-gray-600 dark:text-racing-200">
            {insight.analysis}
          </p>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-gray-400">{insight.formulaNote}</p>
    </div>
  )
}
