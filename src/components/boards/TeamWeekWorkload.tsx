import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, ArrowRight } from 'lucide-react'
import { useOrganizationStore } from '../../store/organizationStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { useBoardsStore } from '../../store/boardsStore'
import { useTaskTimeStore } from '../../store/taskTimeStore'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { formatHM } from '../../utils/worktime'

/**
 * Compact org-wide "Team diese Woche" — open project tasks + load vs weekly capacity.
 * Reuses CapacityTracker / org members / project assignees (not a Monday Workload clone).
 */
export default function TeamWeekWorkload({ showLink }: { showLink?: boolean }) {
  const { t } = useTranslation('boards')
  const members = useOrganizationStore((s) => s.members ?? [])
  const boards = useBoardsStore((s) => s.boards)
  const myTasks = useProjectTasksStore((s) => s.myTasks)
  const boardTasks = useProjectTasksStore((s) => s.tasks)
  const timeEntries = useTaskTimeStore((s) => s.entries ?? [])
  const settings = useWorkTimeStore((s) => s.settings)
  const weeklyCapacity = Math.round((settings.weeklyHours || 38.5) * 60)

  const rows = useMemo(() => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const weekStartIso = weekStart.toISOString().slice(0, 10)

    const allTasks = [...myTasks]
    const seen = new Set(allTasks.map((tk) => tk.id))
    for (const tk of boardTasks) {
      if (!seen.has(tk.id)) allTasks.push(tk)
    }
    const open = allTasks.filter((tk) => !tk.completed && tk.boardId)

    const map = new Map<
      string,
      { name: string; color: string; open: number; estimated: number; logged: number }
    >()

    const people =
      members.length > 0
        ? members.map((m) => ({
            id: m.userId,
            name: m.profile.display_name || m.profile.username,
            color: m.profile.avatar_color || '#6B7280',
          }))
        : boards.flatMap((b) =>
            b.members.map((m) => ({
              id: m.userId,
              name: m.profile.display_name,
              color: m.profile.avatar_color,
            })),
          )

    for (const p of people) {
      if (!map.has(p.id)) map.set(p.id, { name: p.name, color: p.color, open: 0, estimated: 0, logged: 0 })
    }

    for (const tk of open) {
      const ids = tk.assigneeIds?.length ? tk.assigneeIds : tk.assignedTo ? [tk.assignedTo] : []
      for (const uid of ids) {
        const row = map.get(uid)
        if (!row) continue
        row.open += 1
        row.estimated += tk.estimatedMinutes ?? 0
      }
    }

    for (const e of timeEntries) {
      if (e.date < weekStartIso) continue
      const row = map.get(e.userId)
      if (row) row.logged += e.minutes
    }

    return [...map.values()]
      .filter((r) => r.open > 0 || r.logged > 0)
      .sort((a, b) => b.open - a.open || b.logged - a.logged)
  }, [members, boards, myTasks, boardTasks, timeEntries])

  if (rows.length === 0) return null

  return (
    <div className="bento-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-accent" />
        <h3 className="text-sm font-semibold">{t('workload.title')}</h3>
        <span className="ml-auto text-[10px] text-gray-400">
          {t('workload.capacityHint', { hours: settings.weeklyHours })}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.slice(0, 8).map((r) => {
          const load = Math.max(r.estimated, r.logged)
          const pct = weeklyCapacity > 0 ? Math.round((load / weeklyCapacity) * 100) : 0
          const over = pct > 100
          return (
            <li key={r.name} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-racing-800">
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: r.color }}
              >
                {r.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-[11px] text-gray-400">
                  {t('workload.open', { count: r.open })}
                  {r.estimated > 0 && ` · ${t('workload.estimated', { time: formatHM(r.estimated) })}`}
                  {r.logged > 0 && ` · ${t('workload.logged', { time: formatHM(r.logged) })}`}
                </p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-racing-700">
                  <div
                    className={`h-full rounded-full ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, Math.max(pct, load > 0 ? 4 : 0))}%` }}
                  />
                </div>
              </div>
              <span className={`text-xs font-semibold tabular-nums ${over ? 'text-red-500' : 'text-gray-500'}`}>
                {pct}%
              </span>
            </li>
          )
        })}
      </ul>
      {showLink && (
        <Link
          to="/arbeitszeit"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
        >
          {t('workload.openWorktime')} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  )
}
