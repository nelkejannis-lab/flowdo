import { useTranslation } from 'react-i18next'
import { BarChart3, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import type { Board, Task } from '../../types'
import { useTaskTimeStore } from '../../store/taskTimeStore'
import { formatHM } from '../../utils/worktime'

interface Props {
  board: Board
  tasks: Task[]
}

export default function ProjectEvaluationPanel({ board, tasks }: Props) {
  const { t } = useTranslation('boards')
  const getEstimateComparison = useTaskTimeStore((s) => s.getEstimateComparison)
  const getBoardSummary = useTaskTimeStore((s) => s.getBoardSummary)

  const comparison = getEstimateComparison(tasks)
  const summary = getBoardSummary(board.id, tasks.map((tk) => tk.id))
  const done = tasks.filter((tk) => tk.completed).length
  const progress = tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)

  const delta = comparison.actual - comparison.estimated
  const deltaPct = comparison.estimated > 0 ? Math.round((delta / comparison.estimated) * 100) : 0
  const TrendIcon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
  const trendColor = delta > 0 ? 'text-red-500' : delta < 0 ? 'text-emerald-500' : 'text-gray-400'

  if (tasks.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-100/80 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 size={16} className="text-accent" />
        <h3 className="text-sm font-semibold">{t('evaluation.title')}</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-racing-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('evaluation.estimated')}</p>
          <p className="text-lg font-bold tabular-nums">{formatHM(comparison.estimated)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-racing-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('evaluation.actual')}</p>
          <p className="text-lg font-bold tabular-nums">{formatHM(summary.totalMinutes)}</p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-racing-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('evaluation.variance')}</p>
          <p className={`flex items-center gap-1 text-lg font-bold tabular-nums ${trendColor}`}>
            <TrendIcon size={16} />
            {delta >= 0 ? '+' : ''}{formatHM(Math.abs(delta))}
            {comparison.estimated > 0 && <span className="text-xs font-normal">({deltaPct}%)</span>}
          </p>
        </div>
        <div className="rounded-xl bg-gray-50 p-3 dark:bg-racing-800">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('evaluation.completion')}</p>
          <p className="text-lg font-bold tabular-nums">{progress}%</p>
        </div>
      </div>
    </div>
  )
}
