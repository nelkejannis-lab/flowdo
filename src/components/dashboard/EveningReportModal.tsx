import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, X, CheckCircle2, Clock, ArrowRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import DayTimeTimeline from '../worktime/DayTimeTimeline'

interface DoneTask {
  id: string
  title: string
}

interface OpenTask {
  id: string
  title: string
  priority?: string
}

interface Props {
  doneTasks: DoneTask[]
  openTasks: OpenTask[]
  workedLabel: string
  taskMinutesLabel?: string
  suggestedTop3: OpenTask[]
  onConfirmTop3: (ids: string[]) => void
  onClose: () => void
  onOpenTimeline?: () => void
  onOpenJournal?: () => void
}

export default function EveningReportModal({
  doneTasks,
  openTasks,
  workedLabel,
  taskMinutesLabel,
  suggestedTop3,
  onConfirmTop3,
  onClose,
  onOpenTimeline,
  onOpenJournal,
}: Props) {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const dayLabel = format(new Date(), 'EEEE, d. MMMM', { locale: dateLocale })
  const [picked, setPicked] = useState<string[]>(() => suggestedTop3.slice(0, 3).map((tk) => tk.id))
  const [showTimeline, setShowTimeline] = useState(true)

  const candidates = useMemo(() => {
    const ids = new Set(suggestedTop3.map((tk) => tk.id))
    const rest = openTasks.filter((tk) => !ids.has(tk.id))
    return [...suggestedTop3, ...rest].slice(0, 8)
  }, [suggestedTop3, openTasks])

  function toggle(id: string) {
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 3) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-[3px] sm:items-center sm:p-6">
      <div className="bento-card relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="relative overflow-hidden px-5 pb-4 pt-5 sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-gray-400 hover:bg-black/[0.05] hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label={t('eveningReport.close')}
          >
            <X size={16} strokeWidth={1.6} />
          </button>
          <div className="relative flex items-start gap-3 pr-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-500">
              <Moon size={22} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-500 dark:text-racing-300">
                {t('eveningReport.greeting')}
              </p>
              <h2 className="text-xl font-semibold tracking-tight">{t('eveningReport.title')}</h2>
              <p className="mt-0.5 text-xs text-gray-400">{dayLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-2 sm:px-6">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {t('eveningReport.done')}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{doneTasks.length}</p>
            </div>
            <div className="rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {t('eveningReport.time')}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{workedLabel}</p>
              {taskMinutesLabel ? (
                <p className="text-[11px] text-gray-400">
                  {t('eveningReport.taskTime', { time: taskMinutesLabel })}
                </p>
              ) : null}
            </div>
          </div>

          {doneTasks.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                <CheckCircle2 size={12} /> {t('eveningReport.wins')}
              </h3>
              <ul className="space-y-1.5">
                {doneTasks.slice(0, 5).map((tk) => (
                  <li
                    key={tk.id}
                    className="truncate rounded-2xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200"
                  >
                    {tk.title}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-gray-100 p-3 dark:border-racing-800">
            <button
              type="button"
              onClick={() => setShowTimeline((v) => !v)}
              className="mb-2 flex w-full items-center gap-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400"
            >
              <Clock size={12} /> {t('eveningReport.timeToday')}
              <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-accent">
                {showTimeline ? t('eveningReport.hideTimeline') : t('eveningReport.showTimeline')}
              </span>
            </button>
            {showTimeline && <DayTimeTimeline compact />}
          </section>

          <section>
            <h3 className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              <Sparkles size={12} /> {t('eveningReport.tomorrowTop3')}
            </h3>
            <p className="mb-2 text-xs text-gray-400">{t('eveningReport.tomorrowHint')}</p>
            {candidates.length === 0 ? (
              <p className="rounded-2xl bg-black/[0.03] px-3 py-3 text-sm text-gray-400 dark:bg-white/[0.04]">
                {t('eveningReport.noOpen')}
              </p>
            ) : (
              <div className="space-y-1.5">
                {candidates.map((tk) => {
                  const active = picked.includes(tk.id)
                  const rank = active ? picked.indexOf(tk.id) + 1 : null
                  return (
                    <button
                      key={tk.id}
                      type="button"
                      onClick={() => toggle(tk.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition ${
                        active
                          ? 'bg-accent/15 ring-1 ring-accent/40'
                          : 'bg-black/[0.03] dark:bg-white/[0.04]'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                          active ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500 dark:bg-racing-700'
                        }`}
                      >
                        {rank ?? '·'}
                      </span>
                      <span className="truncate text-sm font-medium">{tk.title}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-black/[0.05] p-4 dark:border-white/[0.06] sm:p-5">
          <div className="mb-3 flex flex-wrap gap-2">
            {onOpenJournal && (
              <button
                type="button"
                onClick={() => {
                  onConfirmTop3(picked)
                  onClose()
                  onOpenJournal()
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/25 hover:brightness-110"
              >
                {t('eveningReport.openJournal')}
              </button>
            )}
            {onOpenTimeline && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onOpenTimeline()
                }}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
              >
                <Clock size={15} />
                {t('eveningReport.whereWasTime')}
              </button>
            )}
          </div>
          <div className="mb-3 flex">
            <Link
              to="/tasks/inbox"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              {t('eveningReport.openInbox')} <ArrowRight size={12} />
            </Link>
          </div>
          <button
            type="button"
            onClick={() => {
              onConfirmTop3(picked)
              onClose()
              if (onOpenJournal && new Date().getHours() >= 19) onOpenJournal()
            }}
            className="w-full rounded-full bg-black/[0.06] py-2.5 text-sm font-semibold text-gray-800 hover:bg-black/[0.09] dark:bg-white/[0.08] dark:text-racing-100"
          >
            {t('eveningReport.saveClose')}
          </button>
        </div>
      </div>
    </div>
  )
}
