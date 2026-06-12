import { Link } from 'react-router-dom'
import { Building2, Calendar, Globe, Users } from 'lucide-react'
import type { Board } from '../../types'
import { useBoardsStore } from '../../store/boardsStore'
import { formatFriendlyDate, isOverdue } from '../../utils/date'

export default function BoardCard({ board }: { board: Board }) {
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
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-racing-800">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progress}%`, backgroundColor: board.color }}
          />
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-racing-200">{progress}%</span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{done}/{total} Aufgaben</span>
        <div className="flex items-center gap-2">
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
      {(board.internalLaunch || board.externalLaunch) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
          {board.internalLaunch && (
            <span className="flex items-center gap-1">
              <Building2 size={12} />
              Intern: {formatFriendlyDate(board.internalLaunch)}
            </span>
          )}
          {board.externalLaunch && (
            <span className="flex items-center gap-1">
              <Globe size={12} />
              Extern: {formatFriendlyDate(board.externalLaunch)}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
