import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, AlertTriangle } from 'lucide-react'
import { useOrganizationStore } from '../../store/organizationStore'
import { useTaskTimeStore } from '../../store/taskTimeStore'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { formatHM } from '../../utils/worktime'

export default function CapacityTracker() {
  const { t } = useTranslation('admin')
  const members = useOrganizationStore((s) => s.members)
  const timeEntries = useTaskTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)

  const weeklyContractMinutes = Math.round(settings.weeklyHours * 60)

  const rows = useMemo(() => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    const weekStartIso = weekStart.toISOString().slice(0, 10)

    return members.map((m) => {
      const logged = timeEntries
        .filter((e) => e.userId === m.userId && e.date >= weekStartIso)
        .reduce((sum, e) => sum + e.minutes, 0)
      const pct = weeklyContractMinutes > 0 ? Math.round((logged / weeklyContractMinutes) * 100) : 0
      return {
        userId: m.userId,
        name: m.profile.display_name || m.profile.username,
        logged,
        pct,
        over: pct > 100,
      }
    })
  }, [members, timeEntries, weeklyContractMinutes])

  if (members.length === 0) return null

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <div className="mb-3 flex items-center gap-2">
        <Users size={16} className="text-accent" />
        <h3 className="text-sm font-semibold">{t('capacity.title')}</h3>
        <span className="ml-auto text-[10px] text-gray-400">{t('capacity.weekHint', { hours: settings.weeklyHours })}</span>
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.userId} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-racing-800">
            <span className="flex-1 truncate text-sm font-medium">{r.name}</span>
            <span className="text-xs tabular-nums text-gray-500">{formatHM(r.logged)}</span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-racing-700">
              <div
                className={`h-full rounded-full ${r.over ? 'bg-red-500' : r.pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, r.pct)}%` }}
              />
            </div>
            <span className={`text-xs font-semibold tabular-nums ${r.over ? 'text-red-500' : 'text-gray-500'}`}>
              {r.pct}%
            </span>
            {r.over && <AlertTriangle size={14} className="text-red-500" />}
          </li>
        ))}
      </ul>
    </div>
  )
}
