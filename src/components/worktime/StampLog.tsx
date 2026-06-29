import { useTranslation } from 'react-i18next'
import { LogIn, LogOut, ShieldCheck, AlertTriangle, History } from 'lucide-react'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { todayISO } from '../../utils/date'
import {
  punchesForDay,
  formatPunchTime,
  arbzgWarnings,
  netMinutes,
  type ArbZgWarning,
} from '../../utils/worktime'

function warningLabel(t: (k: string) => string, w: ArbZgWarning): string {
  if (w.code === 'maxDaily') return t('arbzg.maxDaily')
  if (w.code === 'rest') return t('arbzg.rest')
  return t('arbzg.break')
}

export default function StampLog() {
  const { t } = useTranslation('worktime')
  const punches = useWorkTimeStore((s) => s.punches)
  const auditLog = useWorkTimeStore((s) => s.auditLog)
  const entries = useWorkTimeStore((s) => s.entries)

  const today = todayISO()
  const todayPunches = punchesForDay(punches, today)
  const todayEntry = entries[today]

  // previous day's last "out" punch + today's first "in" for the rest-period check
  const sortedPunches = [...punches].sort((a, b) => a.punchedAt.localeCompare(b.punchedAt))
  const firstInToday = todayPunches.find((p) => p.kind === 'in')?.punchedAt
  const prevOut = sortedPunches
    .filter((p) => p.kind === 'out' && new Date(p.punchedAt).toISOString() < today + 'T00:00:00.000Z')
    .slice(-1)[0]?.punchedAt

  const warnings = arbzgWarnings(todayEntry, prevOut, firstInToday)
  const todayAudit = auditLog.filter((a) => a.entryDate === today)

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 dark:border-racing-800 dark:bg-racing-900">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-emerald-500" />
        <h3 className="text-sm font-semibold">{t('stampLog.title')}</h3>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          {t('stampLog.tamperProof')}
        </span>
      </div>

      {/* ArbZG warnings */}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                w.severity === 'error'
                  ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
              }`}
            >
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{warningLabel(t, w)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Punch list */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">{t('stampLog.todayPunches')}</p>
        {todayPunches.length === 0 ? (
          <p className="text-xs italic text-gray-400">{t('stampLog.noPunches')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {todayPunches.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                {p.kind === 'in' ? (
                  <LogIn size={14} className="text-emerald-500" />
                ) : (
                  <LogOut size={14} className="text-red-500" />
                )}
                <span className="font-medium">{p.kind === 'in' ? t('stampLog.clockIn') : t('stampLog.clockOut')}</span>
                <span className="ml-auto tabular-nums text-gray-500 dark:text-racing-300">{formatPunchTime(p.punchedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        {todayEntry && (
          <p className="mt-2 text-[11px] text-gray-400">
            {t('stampLog.netToday')}: <span className="font-semibold text-gray-600 dark:text-racing-200">{Math.floor(netMinutes(todayEntry) / 60)}:{String(netMinutes(todayEntry) % 60).padStart(2, '0')} h</span>
          </p>
        )}
      </div>

      {/* Audit trail */}
      {todayAudit.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <History size={12} /> {t('stampLog.changeLog')}
          </p>
          <ul className="flex flex-col gap-1">
            {todayAudit.map((a) => (
              <li key={a.id} className="text-[11px] text-gray-500 dark:text-racing-400">
                <span className="tabular-nums">{formatPunchTime(a.changedAt)}</span> · {a.field}: {a.oldValue ?? '—'} → {a.newValue ?? '—'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
