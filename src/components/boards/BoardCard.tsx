import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Calendar, Globe, Users } from 'lucide-react'
import type { Board } from '../../types'
import { useBoardsStore } from '../../store/boardsStore'
import { formatFriendlyDate, isOverdue } from '../../utils/date'
import ProgressRing from './ProgressRing'

export default function BoardCard({ board }: { board: Board }) {
  const { t } = useTranslation('boards')
  const stats = useBoardsStore((s) => s.taskStats[board.id])
  const total = stats?.total ?? 0
  const done = stats?.done ?? 0
  const progress = total === 0 ? 0 : Math.round((done / total) * 100)
  const overdue = isOverdue(board.deadline)

  return (
    <Link
      to={`/projekte/${board.id}`}
      className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-racing-800 dark:bg-racing-900"
    >
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: board.color }} />
        <h3 className="truncate font-semibold">{board.title}</h3>
      </div>
      {board.description && (
        <p className="line-clamp-2 text-sm text-gray-500 dark:text-racing-200">{board.description}</p>
      )}
      <div className="flex items-center gap-3">
        <ProgressRing progress={progress} color={board.color} />
        <div className="flex flex-1 items-center justify-between text-xs text-gray-400">
        <span>{done}/{total} {t('card.tasks', { count: total })}</span>
        <div className="flex items-center gap-2">
          {board.responsibleProfile && (
            <span className="flex items-center gap-1" title={t('card.responsible', { name: board.responsibleProfile.display_name })}>
              <span className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: board.responsibleProfile.avatar_color }}>
                {board.responsibleProfile.display_name.slice(0, 2).toUpperCase()}
              </span>
            </span>
          )}
          {board.members.length > 0 && (
            <span className="flex items-center gap-1">
              <Users size={12} />
              {board.members.length + 1}
            </span>
          )}
          {board.deadline && (
            <span className={`flex items-center gap-1 ${overdue ? 'font-medium text-red-500' : ''}`}>
              <Calendar size={12} />
              {formatFriendlyDate(board.deadline)}
            </span>
          )}
        </div>
        </div>
      </div>
      {(board.internalLaunch || board.externalLaunch) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          {board.internalLaunch && (
            <span className="flex items-center gap-1">
              <Building2 size={12} />
              {t('card.internal', { date: formatFriendlyDate(board.internalLaunch) })}
            </span>
          )}
          {board.externalLaunch && (
            <span className="flex items-center gap-1">
              <Globe size={12} />
              {t('card.external', { date: formatFriendlyDate(board.externalLaunch) })}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
