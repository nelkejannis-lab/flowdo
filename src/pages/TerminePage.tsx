import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Plus } from 'lucide-react'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import { useTasksStore } from '../store/tasksStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { entryTypeIcon, entryTypeLabel } from '../utils/calendarEntry'
import { isDueThisWeek, isDueToday, isOverdue, todayISO } from '../utils/date'
import CalendarEntryFormModal from '../components/calendar/CalendarEntryFormModal'
import TaskList from '../components/tasks/TaskList'
import type { CalendarEntry } from '../types'

type Filter = 'today' | 'week' | 'upcoming' | 'past' | 'all'

export default function TerminePage() {
  const { t, i18n } = useTranslation('calendar')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const entries = useCalendarEntriesStore((s) => s.entries)
  const fetchEntries = useCalendarEntriesStore((s) => s.fetchEntries)
  const tasks = useTasksStore((s) => s.tasks)
  const fetchTasks = useTasksStore((s) => s.fetchAll)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const fetchMyProjectTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<CalendarEntry | undefined>()

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchEntries()
      fetchTasks()
      fetchMyProjectTasks()
    }
  }, [fetchEntries, fetchTasks, fetchMyProjectTasks])

  const today = todayISO()

  const weekEndDate = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? 0 : 7 - day
    const end = new Date(d)
    end.setDate(d.getDate() + diff)
    return end.toISOString().slice(0, 10)
  })()

  const allTasks = [...tasks, ...myProjectTasks]

  const todayTasks = allTasks.filter(
    (tk) => !tk.completed && (isDueToday(tk.dueDate) || isOverdue(tk.dueDate))
  )

  const weekTasks = allTasks.filter(
    (tk) => !tk.completed && (isOverdue(tk.dueDate) || isDueToday(tk.dueDate) || isDueThisWeek(tk.dueDate))
  )

  const filtered = entries
    .filter((e) => {
      const endDate = e.endDate ?? e.date
      if (filter === 'today') return e.date <= today && endDate >= today
      if (filter === 'week') return e.date <= weekEndDate && endDate >= today && !(e.date < today && endDate < today)
      if (filter === 'upcoming') return endDate >= today
      if (filter === 'past') return endDate < today
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  // Group: today → this week → by month
  const todaySection = filtered.filter((e) => e.date === today)
  const weekSection = filtered.filter((e) => e.date !== today && e.date > today && e.date <= weekEndDate)
  const restEntries = filtered.filter((e) => e.date > weekEndDate || (e.date < today && !(e.endDate && e.endDate >= today)))

  const grouped = new Map<string, CalendarEntry[]>()
  for (const entry of restEntries) {
    const key = entry.date.slice(0, 7)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(entry)
  }

  const filters: Filter[] = ['today', 'week', 'upcoming', 'past', 'all']

  function renderEntry(entry: CalendarEntry) {
    const isToday = entry.date === today
    const isOngoing = entry.date < today && entry.endDate && entry.endDate >= today
    return (
      <div
        key={entry.id}
        onClick={() => { setEditEntry(entry); setShowForm(true) }}
        className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 hover:bg-gray-50 dark:border-racing-800 dark:bg-racing-900 dark:hover:bg-racing-800"
      >
        <span
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base text-white"
          style={{ backgroundColor: entry.color }}
        >
          {entryTypeIcon[entry.type]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{entry.title}</p>
          <p className="text-xs text-gray-400">
            {entryTypeLabel[entry.type]} ·{' '}
            {format(parseISO(entry.date), 'd. MMM yyyy', { locale: dateLocale })}
            {entry.endDate && entry.endDate > entry.date
              ? ` – ${format(parseISO(entry.endDate), 'd. MMM yyyy', { locale: dateLocale })}`
              : ''}
            {(entry.startTime || entry.endTime) && (
              <> · {entry.startTime ?? ''}{entry.endTime ? ` – ${entry.endTime}` : ''}</>
            )}
          </p>
        </div>
        {isToday && (
          <span className="flex-shrink-0 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
            {t('termine.filters.today')}
          </span>
        )}
        {isOngoing && (
          <span className="flex-shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {t('termine.ongoing')}
          </span>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('termine.title')}</h1>
        <button
          onClick={() => { setEditEntry(undefined); setShowForm(true) }}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={16} />
          {t('termine.add')}
        </button>
      </div>

      <div className="mb-6 flex gap-1 border-b border-gray-100 dark:border-racing-800">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              filter === f
                ? 'border-accent text-accent'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-racing-200'
            }`}
          >
            {t(`termine.filters.${f}`)}
          </button>
        ))}
      </div>

      {(filter === 'today' || filter === 'week') && (
        <div className="mb-6 flex flex-col gap-6">
          {/* Appointments section */}
          {filtered.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {t('termine.appointments')}
              </h2>
              <div className="flex flex-col gap-2">{filtered.map(renderEntry)}</div>
            </div>
          )}

          {/* Tasks section */}
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t('termine.tasks')}
            </h2>
            {(filter === 'today' ? todayTasks : weekTasks).length === 0 ? (
              <p className="text-sm text-gray-400">{t('termine.noTasks')}</p>
            ) : (
              <TaskList
                tasks={filter === 'today' ? todayTasks : weekTasks}
                groupByDate={filter === 'week'}
                emptyMessage=""
              />
            )}
          </div>
        </div>
      )}

      {filter !== 'today' && filter !== 'week' && (
        filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <CalendarDays size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{t('termine.empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {todaySection.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('termine.filters.today')}</h2>
                <div className="flex flex-col gap-2">{todaySection.map(renderEntry)}</div>
              </div>
            )}
            {weekSection.length > 0 && (
              <div>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('termine.filters.week')}</h2>
                <div className="flex flex-col gap-2">{weekSection.map(renderEntry)}</div>
              </div>
            )}
            {[...grouped.entries()].map(([month, monthEntries]) => (
              <div key={month}>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {format(parseISO(month + '-01'), 'MMMM yyyy', { locale: dateLocale })}
                </h2>
                <div className="flex flex-col gap-2">{monthEntries.map(renderEntry)}</div>
              </div>
            ))}
          </div>
        )
      )}

      {showForm && (
        <CalendarEntryFormModal
          entry={editEntry}
          onClose={() => { setShowForm(false); setEditEntry(undefined) }}
        />
      )}
    </div>
  )
}
