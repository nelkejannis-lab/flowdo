import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { de, enUS } from 'date-fns/locale'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { LogIn, LogOut, ShieldCheck, AlertTriangle, History, ChevronLeft, ChevronRight, CalendarDays, Download } from 'lucide-react'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { useAuthStore } from '../../store/authStore'
import { todayISO, toISODate } from '../../utils/date'
import {
  punchesForDay,
  formatPunchTime,
  arbzgWarnings,
  netMinutes,
  type ArbZgWarning,
} from '../../utils/worktime'
import { buildMonthlyTimesheetCsv, downloadCsv } from '../../utils/worktimeExport'

function warningLabel(t: (k: string) => string, w: ArbZgWarning): string {
  if (w.code === 'maxDaily') return t('arbzg.maxDaily')
  if (w.code === 'rest') return t('arbzg.rest')
  return t('arbzg.break')
}

export default function StampLog() {
  const { t, i18n } = useTranslation('worktime')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const punches = useWorkTimeStore((s) => s.punches)
  const auditLog = useWorkTimeStore((s) => s.auditLog)
  const entries = useWorkTimeStore((s) => s.entries)
  const settings = useWorkTimeStore((s) => s.settings)
  const profile = useAuthStore((s) => s.profile)

  const today = todayISO()
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today

  const dayPunches = punchesForDay(punches, selectedDate)
  const dayEntry = entries[selectedDate]

  // previous day's last "out" punch + selected day's first "in" for the rest-period check
  const sortedPunches = [...punches].sort((a, b) => a.punchedAt.localeCompare(b.punchedAt))
  const firstInDay = dayPunches.find((p) => p.kind === 'in')?.punchedAt
  const prevOut = sortedPunches
    .filter((p) => p.kind === 'out' && p.punchedAt < selectedDate + 'T00:00:00.000Z')
    .slice(-1)[0]?.punchedAt

  const warnings = arbzgWarnings(dayEntry, prevOut, firstInDay)
  const dayAudit = auditLog.filter((a) => a.entryDate === selectedDate)

  const dayLabel = format(parseISO(selectedDate), 'EEEE, d. MMMM yyyy', { locale: dateLocale })

  function shiftDay(delta: number) {
    setSelectedDate((d) => toISODate(delta > 0 ? addDays(parseISO(d), 1) : subDays(parseISO(d), 1)))
  }

  function handleExport() {
    const month = selectedDate.slice(0, 7) // yyyy-MM
    const name = profile?.display_name || profile?.username || 'Mitarbeiter'
    const csv = buildMonthlyTimesheetCsv(month, entries, punches, auditLog, settings, name)
    downloadCsv(`Arbeitszeitnachweis_${month}.csv`, csv)
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-gray-100 bg-white p-5 dark:border-racing-800 dark:bg-racing-900">
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-emerald-500" />
        <h3 className="text-sm font-semibold">{t('stampLog.title')}</h3>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          {t('stampLog.tamperProof')}
        </span>
      </div>

      <button
        onClick={handleExport}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800"
      >
        <Download size={13} /> {t('stampLog.exportMonth')}
      </button>

      {/* Day navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => shiftDay(-1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5 text-xs font-medium text-gray-600 dark:text-racing-200">
          <CalendarDays size={13} className="text-gray-400" />
          {dayLabel}
        </div>
        <button
          onClick={() => shiftDay(1)}
          disabled={isToday}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-racing-700 dark:hover:bg-racing-800"
        >
          <ChevronRight size={14} />
        </button>
        {!isToday && (
          <button
            onClick={() => setSelectedDate(today)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-accent hover:bg-accent/5 dark:border-racing-700"
          >
            {t('stampLog.today')}
          </button>
        )}
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
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">{t('stampLog.punchesOnDay')}</p>
        {dayPunches.length === 0 ? (
          <p className="text-xs italic text-gray-400">{t('stampLog.noPunches')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {dayPunches.map((p) => (
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
        {dayEntry && (
          <p className="mt-2 text-[11px] text-gray-400">
            {t('stampLog.netOnDay')}: <span className="font-semibold text-gray-600 dark:text-racing-200">{Math.floor(netMinutes(dayEntry) / 60)}:{String(netMinutes(dayEntry) % 60).padStart(2, '0')} h</span>
          </p>
        )}
      </div>

      {/* Audit trail */}
      {dayAudit.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            <History size={12} /> {t('stampLog.changeLog')}
          </p>
          <ul className="flex flex-col gap-1">
            {dayAudit.map((a) => (
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
