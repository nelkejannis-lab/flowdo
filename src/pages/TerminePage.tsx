import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Plus } from 'lucide-react'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { entryTypeIcon, entryTypeLabel } from '../utils/calendarEntry'
import { todayISO } from '../utils/date'
import CalendarEntryFormModal from '../components/calendar/CalendarEntryFormModal'
import type { CalendarEntry } from '../types'

type Filter = 'upcoming' | 'past' | 'all'

export default function TerminePage() {
  const { t, i18n } = useTranslation('calendar')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const entries = useCalendarEntriesStore((s) => s.entries)
  const fetchEntries = useCalendarEntriesStore((s) => s.fetchEntries)
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [showForm, setShowForm] = useState(false)
  const [editEntry, setEditEntry] = useState<CalendarEntry | undefined>()

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchEntries()
    }
  }, [fetchEntries])

  const today = todayISO()

  const weekEndDate = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? 0 : 7 - day
    const end = new Date(d)
    end.setDate(d.getDate() + diff)
    return end.toISOString().slice(0, 10)
  })()

  const filtered = entries
    .filter((e) => {
      const endDate = e.endDate ?? e.date
      if (filter === 'upcoming') return endDate >= today
      if (filter === 'past') return endDate < today
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const nowTime = new Date().toTimeString().slice(0, 5) // "HH:MM"
  const todayEntries = filtered.filter((e) => {
    if (e.date !== today) return false
    const endT = e.endTime ?? e.startTime
    if (endT && endT < nowTime) return false
    return true
  })
  const weekEntries = filtered.filter((e) => e.date !== today && e.date > today && e.date <= weekEndDate)
  const restEntries = filtered.filter((e) => e.date > weekEndDate || e.date < today)

  const grouped = new Map<string, CalendarEntry[]>()
  for (const entry of restEntries) {
    const key = entry.date.slice(0, 7)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(entry)
  }

  const filters: Filter[] = ['upcoming', 'past', 'all']

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

  const isEmpty = filtered.length === 0

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

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <CalendarDays size={40} className="mb-3 opacity-30" />
          <p className="text-sm">{t('termine.empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Heute */}
          {todayEntries.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('termine.filters.today')}</h2>
              <div className="flex flex-col gap-2">{todayEntries.map(renderEntry)}</div>
            </div>
          )}

          {/* Diese Woche */}
          {weekEntries.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('termine.filters.week')}</h2>
              <div className="flex flex-col gap-2">{weekEntries.map(renderEntry)}</div>
            </div>
          )}

          {/* Monate */}
          {[...grouped.entries()].map(([month, monthEntries]) => (
            <div key={month}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {format(parseISO(month + '-01'), 'MMMM yyyy', { locale: dateLocale })}
              </h2>
              <div className="flex flex-col gap-2">{monthEntries.map(renderEntry)}</div>
            </div>
          ))}
        </div>
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
