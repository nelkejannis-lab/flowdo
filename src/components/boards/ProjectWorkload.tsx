import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import type { Board, Task } from '../../types'
import { formatHM } from '../../utils/worktime'

interface Props {
  board: Board
  tasks: Task[]
  byTask: Record<string, number>
}

export default function ProjectWorkload({ board, tasks, byTask }: Props) {
  const { t } = useTranslation('boards')

  const rows = useMemo(() => {
    const open = tasks.filter((tk) => !tk.completed)
    const map = new Map<string, { name: string; color: string; open: number; estimated: number; logged: number }>()

    for (const m of board.members) {
      map.set(m.userId, {
        name: m.profile.display_name,
        color: m.profile.avatar_color,
        open: 0,
        estimated: 0,
        logged: 0,
      })
    }

    for (const tk of open) {
      const ids = tk.assigneeIds?.length ? tk.assigneeIds : tk.assignedTo ? [tk.assignedTo] : [tk.ownerId ?? '']
      for (const uid of ids.filter(Boolean)) {
        const row = map.get(uid)
        if (!row) continue
        row.open += 1
        row.estimated += tk.estimatedMinutes ?? 0
        row.logged += byTask[tk.id] ?? 0
      }
    }

    return [...map.values()].sort((a, b) => b.open - a.open)
  }, [board.members, tasks, byTask])

  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-100 p-4 dark:border-racing-800">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Users size={14} />
        {t('workload.title')}
      </h3>
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
            <span className="h-7 w-7 flex-shrink-0 rounded-full text-xs font-bold text-white flex items-center justify-center" style={{ backgroundColor: row.color }}>
              {row.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{row.name}</p>
              <p className="text-xs text-gray-400">
                {t('workload.open', { count: row.open })}
                {row.estimated > 0 && ` · ${t('workload.estimated', { time: formatHM(row.estimated) })}`}
                {row.logged > 0 && ` · ${t('workload.logged', { time: formatHM(row.logged) })}`}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              row.open >= 8 ? 'bg-red-100 text-red-600' : row.open >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {row.open}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
