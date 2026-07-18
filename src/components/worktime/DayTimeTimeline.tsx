import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, LogIn, LogOut, ListTodo, ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, format, parseISO, subDays } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useWorkTimeStore } from '../../store/workTimeStore'
import { useTaskTimeStore } from '../../store/taskTimeStore'
import { useTasksStore } from '../../store/tasksStore'
import { useProjectTasksStore } from '../../store/projectTasksStore'
import { buildDayTimeline } from '../../lib/dayTimeTimeline'
import { formatHM, netMinutes } from '../../utils/worktime'
import { todayISO } from '../../utils/date'

interface Props {
  /** Initial date yyyy-MM-dd; defaults to today */
  initialDate?: string
  compact?: boolean
}

export default function DayTimeTimeline({ initialDate, compact }: Props) {
  const { t, i18n } = useTranslation('worktime')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const [date, setDate] = useState(initialDate ?? todayISO())

  const punches = useWorkTimeStore((s) => s.punches)
  const workEntry = useWorkTimeStore((s) => s.entries[date])
  const taskEntries = useTaskTimeStore((s) => s.entries)
  const tasks = useTasksStore((s) => s.tasks)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)

  const taskTitles = useMemo(() => {
    const map: Record<string, string> = {}
    for (const tk of [...tasks, ...myProjectTasks]) map[tk.id] = tk.title
    return map
  }, [tasks, myProjectTasks])

  const timeline = useMemo(
    () =>
      buildDayTimeline({
        dateISO: date,
        punches,
        workEntry,
        taskEntries,
        taskTitles,
      }),
    [date, punches, workEntry, taskEntries, taskTitles],
  )

  const workMin = netMinutes(workEntry)
  const taskMin = taskEntries.filter((e) => e.date === date).reduce((s, e) => s + e.minutes, 0)

  const dayLabel = format(parseISO(date), compact ? 'EEE d.M.' : 'EEEE, d. MMMM', { locale: dateLocale })

  function shift(delta: number) {
    const next = delta < 0 ? subDays(parseISO(date), 1) : addDays(parseISO(date), 1)
    setDate(format(next, 'yyyy-MM-dd'))
  }

  return (
    <div className={compact ? '' : 'bento-card p-5'}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock size={16} className="text-accent" />
            {t('timeline.title')}
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">{t('timeline.subtitle')}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/10"
            aria-label={t('timeline.prev')}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[7.5rem] text-center text-xs font-semibold tabular-nums">{dayLabel}</span>
          <button
            type="button"
            onClick={() => shift(1)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/10"
            aria-label={t('timeline.next')}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/[0.03] px-3 py-2 dark:bg-white/[0.04]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {t('timeline.work')}
          </p>
          <p className="text-lg font-semibold tabular-nums">{formatHM(workMin)}</p>
        </div>
        <div className="rounded-xl bg-black/[0.03] px-3 py-2 dark:bg-white/[0.04]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {t('timeline.tasks')}
          </p>
          <p className="text-lg font-semibold tabular-nums">{formatHM(taskMin)}</p>
        </div>
      </div>

      {timeline.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">{t('timeline.empty')}</p>
      ) : (
        <ol className="relative space-y-0 border-l border-gray-200 pl-4 dark:border-racing-700">
          {timeline.map((item) => {
            const Icon =
              item.kind === 'work_in' ? LogIn : item.kind === 'work_out' ? LogOut : ListTodo
            const color =
              item.kind === 'work_in'
                ? 'text-emerald-500'
                : item.kind === 'work_out'
                  ? 'text-rose-500'
                  : 'text-accent'
            return (
              <li key={item.id} className="relative pb-4 last:pb-0">
                <span
                  className={`absolute -left-[1.35rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-racing-900 ${color}`}
                >
                  <Icon size={12} strokeWidth={2} />
                </span>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  <span className="flex-shrink-0 text-xs tabular-nums text-gray-400">{item.timeLabel}</span>
                </div>
                {item.note && item.note !== item.title ? (
                  <p className="mt-0.5 text-xs text-gray-400">{item.note}</p>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
