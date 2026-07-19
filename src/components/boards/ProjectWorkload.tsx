import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import type { Board, Task } from '../../types'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { formatHM } from '../../utils/worktime'

interface Props {
  board: Board
  tasks: Task[]
  byTask: Record<string, number>
  /** Compact embed (dashboard / arbeitszeit) */
  compact?: boolean
}

function weekStartIso(): string {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  return weekStart.toISOString().slice(0, 10)
}

export default function ProjectWorkload({ board, tasks, byTask, compact }: Props) {
  const { t } = useTranslation('boards')
  const settings = useWorkTimeStore((s) => s.settings)
  const weeklyCapacity = Math.round((settings.weeklyHours || 38.5) * 60)

  const rows = useMemo(() => {
    const open = tasks.filter((tk) => !tk.completed)
    const weekStart = weekStartIso()
    const map = new Map<
      string,
      { name: string; color: string; open: number; estimated: number; logged: number; weekDue: number }
    >()

    for (const m of board.members) {
      map.set(m.userId, {
        name: m.profile.display_name,
        color: m.profile.avatar_color,
        open: 0,
        estimated: 0,
        logged: 0,
        weekDue: 0,
      })
    }

    for (const tk of open) {
      const ids = tk.assigneeIds?.length ? tk.assigneeIds : tk.assignedTo ? [tk.assignedTo] : [tk.ownerId ?? '']
      const dueThisWeek = !!tk.dueDate && tk.dueDate >= weekStart
      for (const uid of ids.filter(Boolean)) {
        const row = map.get(uid)
        if (!row) continue
        row.open += 1
        row.estimated += tk.estimatedMinutes ?? 0
        row.logged += byTask[tk.id] ?? 0
        if (dueThisWeek) row.weekDue += 1
      }
    }

    return [...map.values()].sort((a, b) => b.estimated - a.estimated || b.open - a.open)
  }, [board.members, tasks, byTask])

  if (rows.length === 0) return null

  return (
    <div className={compact ? '' : 'rounded-xl border border-gray-100 p-4 dark:border-racing-800'}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Users size={14} className="text-accent" />
        {t('workload.title')}
        <span className="ml-auto text-[10px] font-normal text-gray-400">
          {t('workload.capacityHint', { hours: settings.weeklyHours })}
        </span>
      </h3>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const load = row.estimated > 0 ? row.estimated : row.logged
          const pct = weeklyCapacity > 0 ? Math.round((load / weeklyCapacity) * 100) : 0
          const over = pct > 100
          return (
            <div
              key={row.name}
              className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800"
            >
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: row.color }}
              >
                {row.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="text-xs text-gray-400">
                  {t('workload.open', { count: row.open })}
                  {row.weekDue > 0 && ` · ${t('workload.weekDue', { count: row.weekDue })}`}
                  {row.estimated > 0 && ` · ${t('workload.estimated', { time: formatHM(row.estimated) })}`}
                  {row.logged > 0 && ` · ${t('workload.logged', { time: formatHM(row.logged) })}`}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-racing-700">
                  <div
                    className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, Math.max(pct, load > 0 ? 4 : 0))}%` }}
                  />
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    row.open >= 8
                      ? 'bg-red-100 text-red-600'
                      : row.open >= 4
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {row.open}
                </span>
                <span className={`text-[10px] font-semibold tabular-nums ${over ? 'text-red-500' : 'text-gray-400'}`}>
                  {pct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
