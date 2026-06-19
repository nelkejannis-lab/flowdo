import { format, isMonday } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { X, Sun, CalendarDays, CheckSquare, AlertCircle, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Task {
  id: string
  title: string
  priority: string
  dueDate?: string
}

interface Entry {
  id: string
  title: string
  startTime?: string
  type: string
}

interface Props {
  todayTasks: Task[]
  weekTasks: Task[]
  todayEntries: Entry[]
  weekEntries: Entry[]
  onClose: () => void
}

const priorityColors: Record<string, string> = {
  high: 'text-red-500',
  medium: 'text-amber-500',
  low: 'text-blue-400',
}

export default function MorningReportModal({ todayTasks, weekTasks, todayEntries, weekEntries, onClose }: Props) {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const isWeekly = isMonday(new Date())
  const hour = new Date().getHours()
  const dayLabel = format(new Date(), 'EEEE, d. MMMM', { locale: dateLocale })
  const greeting = hour < 10
    ? t('morningReport.greetingMorning')
    : hour < 13
    ? t('morningReport.greetingMidday')
    : t('morningReport.greetingAfternoon')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-racing-900">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-accent to-purple-600 px-5 py-4 text-white">
          <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1 hover:bg-white/20">
            <X size={16} />
          </button>
          <div className="flex items-center gap-2">
            <Sun size={20} className="text-yellow-300" />
            <div>
              <p className="text-sm font-medium opacity-80">{greeting}!</p>
              <h2 className="font-bold">{isWeekly ? t('morningReport.weekly') : t('morningReport.daily')}</h2>
              <p className="text-xs opacity-70">{dayLabel}</p>
            </div>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {/* Heute Termine */}
          {todayEntries.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <CalendarDays size={12} /> {t('morningReport.todayAppointments')}
              </h3>
              <div className="space-y-1">
                {todayEntries.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
                    {e.startTime && <span className="text-xs font-semibold tabular-nums text-accent">{e.startTime}</span>}
                    <span className="text-sm">{e.title}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Heute Aufgaben */}
          {todayTasks.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <CheckSquare size={12} /> {t('morningReport.todayDue')}
              </h3>
              <div className="space-y-1">
                {todayTasks.map((tk) => (
                  <div key={tk.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
                    <span className={`h-1.5 w-1.5 rounded-full bg-current flex-shrink-0 ${priorityColors[tk.priority] ?? 'text-gray-400'}`} />
                    <span className="text-sm">{tk.title}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Woche (nur montags) */}
          {isWeekly && (
            <>
              {weekEntries.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <TrendingUp size={12} /> {t('morningReport.weekAppointments')}
                  </h3>
                  <div className="space-y-1">
                    {weekEntries.slice(0, 5).map((e) => (
                      <div key={e.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
                        {e.startTime && <span className="text-xs font-semibold tabular-nums text-accent w-10">{e.startTime}</span>}
                        <span className="text-sm">{e.title}</span>
                      </div>
                    ))}
                    {weekEntries.length > 5 && <p className="text-xs text-gray-400 pl-3">+{weekEntries.length - 5}</p>}
                  </div>
                </section>
              )}
              {weekTasks.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <AlertCircle size={12} /> {t('morningReport.weekDue')}
                  </h3>
                  <div className="space-y-1">
                    {weekTasks.slice(0, 6).map((tk) => (
                      <div key={tk.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 dark:bg-racing-800">
                        <span className={`h-1.5 w-1.5 rounded-full bg-current flex-shrink-0 ${priorityColors[tk.priority] ?? 'text-gray-400'}`} />
                        <span className="text-sm">{tk.title}</span>
                      </div>
                    ))}
                    {weekTasks.length > 6 && <p className="text-xs text-gray-400 pl-3">+{weekTasks.length - 6}</p>}
                  </div>
                </section>
              )}
            </>
          )}

          {todayTasks.length === 0 && todayEntries.length === 0 && !isWeekly && (
            <p className="py-4 text-center text-sm text-gray-400">{t('morningReport.emptyDay')}</p>
          )}
        </div>

        <div className="border-t border-gray-100 p-4 dark:border-racing-800">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            {t('morningReport.letsGo')}
          </button>
        </div>
      </div>
    </div>
  )
}
