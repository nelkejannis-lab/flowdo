import { useEffect, useRef, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Plus, Users, X, Plane, Home, ListTodo, PanelRight } from 'lucide-react'
import { useFriendsStore } from '../store/friendsStore'
import { useTeamsStore } from '../store/teamsStore'
import { useCalendarConnectionsStore } from '../store/calendarConnectionsStore'
import { supabase } from '../lib/supabase'
import MonthView from '../components/calendar/MonthView'
import WeekView from '../components/calendar/WeekView'
import DayView from '../components/calendar/DayView'
import TaskFormModal from '../components/tasks/TaskFormModal'
import CalendarEntryFormModal from '../components/calendar/CalendarEntryFormModal'
import TeamAvailabilitySidebar from '../components/calendar/TeamAvailabilitySidebar'
import { useTasksStore } from '../store/tasksStore'
import { useEventsStore } from '../store/eventsStore'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { toISODate } from '../utils/date'
import { mergeCalendarEntries } from '../utils/mergeEntries'
import type { CalendarEntry, CalendarEvent, Task } from '../types'

type ViewMode = 'month' | 'week' | 'day'
type AbsenceFilter = null | 'urlaub' | 'reise'

export default function CalendarPage() {
  const { t, i18n } = useTranslation('calendar')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const tasks = useTasksStore((s) => s.tasks)
  const events = useEventsStore((s) => s.events)
  const fetchEvents = useEventsStore((s) => s.fetchAll)
  const entries = useCalendarEntriesStore((s) => s.entries)
  const fetchEntries = useCalendarEntriesStore((s) => s.fetchEntries)
  const [view, setView] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskDate, setNewTaskDate] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [absenceFilter, setAbsenceFilter] = useState<AbsenceFilter>(null)
  const [showUpcoming, setShowUpcoming] = useState(false)
  const [showBirthdays, setShowBirthdays] = useState(false)
  const birthdayRef = useRef<HTMLDivElement>(null)
  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)

  // External calendar toggles
  const connections = useCalendarConnectionsStore((s) => s.connections)
  const fetchConnections = useCalendarConnectionsStore((s) => s.fetch)
  const [disabledCalendars, setDisabledCalendars] = useState<Set<string>>(new Set())
  const [showCalendarMenu, setShowCalendarMenu] = useState(false)
  const calendarMenuRef = useRef<HTMLDivElement>(null)

  // Team filter
  const [teamFilterId, setTeamFilterId] = useState<string | null>(null)
  const [teamEntries, setTeamEntries] = useState<CalendarEntry[]>([])
  const [showTeamFilter, setShowTeamFilter] = useState(false)
  const teamFilterRef = useRef<HTMLDivElement>(null)
  const teams = useTeamsStore((s) => s.teams)
  const fetchTeams = useTeamsStore((s) => s.fetch)

  useEffect(() => {
    if (isSupabaseConfigured) { fetchEntries(); fetchFriends(); fetchTeams(); fetchConnections(); fetchEvents() }
  }, [fetchEntries, fetchFriends, fetchTeams, fetchConnections, fetchEvents])

  // Close dropdowns on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (birthdayRef.current && !birthdayRef.current.contains(e.target as Node)) setShowBirthdays(false)
      if (teamFilterRef.current && !teamFilterRef.current.contains(e.target as Node)) setShowTeamFilter(false)
      if (calendarMenuRef.current && !calendarMenuRef.current.contains(e.target as Node)) setShowCalendarMenu(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function toggleCalendar(provider: string) {
    setDisabledCalendars((prev) => {
      const next = new Set(prev)
      next.has(provider) ? next.delete(provider) : next.add(provider)
      return next
    })
  }

  // Filter entries based on disabled calendars
  const providerPrefixes: Record<string, string> = {
    google: '[Google]',
    microsoft: '[Outlook]',
    ical: '[iCal]',
  }
  const filteredEntries = mergeCalendarEntries(entries.filter((e) => {
    for (const [provider, prefix] of Object.entries(providerPrefixes)) {
      if (e.title.startsWith(prefix) && disabledCalendars.has(provider)) return false
    }
    if (absenceFilter && e.type !== absenceFilter) return false
    return true
  }))

  // Load team entries (reise + urlaub) when a team filter is selected
  useEffect(() => {
    if (!teamFilterId) { setTeamEntries([]); return }
    const team = teams.find((t) => t.id === teamFilterId)
    if (!team || team.members.length === 0) { setTeamEntries([]); return }
    const memberIds = team.members.map((m) => m.id)
    supabase
      .from('calendar_entries')
      .select('*, owner:profiles!calendar_entries_owner_id_fkey(*)')
      .in('owner_id', memberIds)
      .in('type', ['reise', 'urlaub'])
      .then(({ data }) => {
        if (data) setTeamEntries(data as unknown as CalendarEntry[])
      })
  }, [teamFilterId, teams])

  // Compute next 10 upcoming birthdays from friends
  const upcomingBirthdays = (() => {
    const today = new Date()
    const thisYear = today.getFullYear()
    return friends
      .filter((f) => f.profile.birthday)
      .map((f) => {
        const bday = new Date(f.profile.birthday!)
        let next = new Date(thisYear, bday.getMonth(), bday.getDate())
        if (next < today) next = new Date(thisYear + 1, bday.getMonth(), bday.getDate())
        const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return { name: f.profile.display_name, color: f.profile.avatar_color, next, diff, age: next.getFullYear() - bday.getFullYear() }
      })
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 10)
  })()

  function navigate(direction: 1 | -1) {
    if (view === 'month') {
      setCurrentDate((d) => (direction === 1 ? addMonths(d, 1) : subMonths(d, 1)))
    } else if (view === 'week') {
      setCurrentDate((d) => (direction === 1 ? addWeeks(d, 1) : subWeeks(d, 1)))
    } else {
      setCurrentDate((d) => (direction === 1 ? addDays(d, 1) : subDays(d, 1)))
    }
  }

  const headerLabel =
    view === 'month'
      ? format(currentDate, 'MMMM yyyy', { locale: dateLocale })
      : view === 'week'
      ? t('weekOf', { date: format(currentDate, 'd. MMM', { locale: dateLocale }) })
      : format(currentDate, 'd. MMMM yyyy', { locale: dateLocale })

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            <ChevronLeft size={16} />
          </button>
          <h1 className="min-w-[180px] text-xl font-semibold capitalize">{headerLabel}</h1>
          <button
            onClick={() => navigate(1)}
            className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="ml-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            {t('today')}
          </button>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 dark:border-racing-700">
          {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                view === v ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'
              }`}
            >
              {v === 'month' ? t('views.month') : v === 'week' ? t('views.week') : t('views.day')}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {isSupabaseConfigured && teams.length > 0 && (
            <div className="relative" ref={teamFilterRef}>
              <button
                onClick={() => setShowTeamFilter((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${teamFilterId ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800'}`}
              >
                <Users size={14} />
                {teamFilterId ? teams.find((tm) => tm.id === teamFilterId)?.name : t('team.label')}
                {teamFilterId && (
                  <span onClick={(e) => { e.stopPropagation(); setTeamFilterId(null) }} className="ml-1 hover:text-red-500">
                    <X size={12} />
                  </span>
                )}
              </button>
              {showTeamFilter && (
                <div className="absolute right-0 top-full z-20 mt-2 w-52 rounded-xl border border-gray-100 bg-white shadow-lg dark:border-racing-800 dark:bg-racing-900">
                  <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('team.select')}</p>
                  {teams.map((tm) => (
                    <button
                      key={tm.id}
                      onClick={() => { setTeamFilterId(tm.id === teamFilterId ? null : tm.id); setShowTeamFilter(false) }}
                      className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-racing-800 ${tm.id === teamFilterId ? 'font-semibold text-accent' : ''}`}
                    >
                      <Users size={14} className="flex-shrink-0 text-gray-400" />
                      {tm.name}
                      <span className="ml-auto text-xs text-gray-400">{tm.members.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {isSupabaseConfigured && (
            <div className="relative" ref={birthdayRef}>
              <button
                onClick={() => setShowBirthdays((v) => !v)}
                title={t('birthdays.tooltip')}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${showBirthdays ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800'}`}
              >
                🎂
              </button>
              {showBirthdays && (
                <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-gray-100 bg-white shadow-lg dark:border-racing-800 dark:bg-racing-900">
                  <div className="border-b border-gray-100 px-4 py-3 dark:border-racing-800">
                    <p className="text-sm font-semibold">{t('birthdays.upcoming')}</p>
                  </div>
                  {upcomingBirthdays.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-gray-400">{t('birthdays.none')}</p>
                  ) : (
                    <div className="flex flex-col divide-y divide-gray-50 dark:divide-racing-800">
                      {upcomingBirthdays.map((b, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <span
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                            style={{ backgroundColor: b.color }}
                          >
                            {b.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{b.name}</p>
                            <p className="text-xs text-gray-400">
                              {format(b.next, 'd. MMM', { locale: dateLocale })} · {t('birthdays.turns', { age: b.age })}
                            </p>
                          </div>
                          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                            b.diff === 0
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                              : b.diff <= 7
                              ? 'bg-accent/10 text-accent'
                              : 'bg-gray-100 text-gray-500 dark:bg-racing-800 dark:text-racing-200'
                          }`}>
                            {b.diff === 0 ? t('birthdays.today') : t('birthdays.inDays', { count: b.diff })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {isSupabaseConfigured && connections.length > 0 && (
            <div className="relative" ref={calendarMenuRef}>
              <button
                onClick={() => setShowCalendarMenu((v) => !v)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${showCalendarMenu ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800'}`}
              >
                {t('externalCalendars.button')}
                {disabledCalendars.size > 0 && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-400 text-[10px] font-bold text-white">
                    {disabledCalendars.size}
                  </span>
                )}
              </button>
              {showCalendarMenu && (
                <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-gray-100 bg-white shadow-lg dark:border-racing-800 dark:bg-racing-900">
                  <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t('externalCalendars.toggleLabel')}</p>
                  {connections.map((conn) => {
                    const label = conn.provider === 'google' ? t('externalCalendars.google')
                      : conn.provider === 'microsoft' ? t('externalCalendars.outlook')
                      : t('externalCalendars.ical')
                    const active = !disabledCalendars.has(conn.provider)
                    return (
                      <button
                        key={conn.provider}
                        onClick={() => toggleCalendar(conn.provider)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-racing-800"
                      >
                        <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${active ? 'border-accent bg-accent' : 'border-gray-300 dark:border-racing-600'}`}>
                          {active && <span className="text-white text-[10px] font-bold">✓</span>}
                        </span>
                        <span className={active ? '' : 'text-gray-400 line-through'}>{label}</span>
                        {conn.email && <span className="ml-auto truncate text-xs text-gray-400 max-w-[80px]">{conn.email.split('@')[0]}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {/* Abwesenheits-Filter */}
          <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-1 dark:border-racing-700">
            <button
              onClick={() => setAbsenceFilter(absenceFilter === 'reise' ? null : 'reise')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${absenceFilter === 'reise' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'}`}
              title={t('absence.offsite')}
            >
              <Home size={12} /> {t('absence.offsite')}
            </button>
            <button
              onClick={() => setAbsenceFilter(absenceFilter === 'urlaub' ? null : 'urlaub')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${absenceFilter === 'urlaub' ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'}`}
              title={t('absence.vacation')}
            >
              <Plane size={12} /> {t('absence.vacation')}
            </button>
          </div>
          <button
            onClick={() => setShowUpcoming((v) => !v)}
            title={t('absence.upcomingTooltip')}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition-colors ${showUpcoming ? 'border-accent bg-accent/10 text-accent' : 'border-gray-200 hover:bg-gray-50 dark:border-racing-700'}`}
          >
            <PanelRight size={14} />
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            <Plus size={14} />
            {t('addButton')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              tasks={tasks}
              events={events}
              entries={filteredEntries}
              onDayClick={(date) => {
                setCurrentDate(date)
                setView('day')
              }}
              onTaskClick={(task) => setEditingTask(task)}
              onEventClick={(event) => setEditingEvent(event)}
              onEntryClick={(entry) => setEditingEntry(entry)}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              tasks={tasks}
              events={events}
              entries={filteredEntries}
              onTaskClick={(task) => setEditingTask(task)}
              onAddTask={(date) => setNewTaskDate(toISODate(date))}
              onEventClick={(event) => setEditingEvent(event)}
              onEntryClick={(entry) => setEditingEntry(entry)}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              tasks={tasks}
              events={events}
              entries={filteredEntries}
              onAddTask={() => setNewTaskDate(toISODate(currentDate))}
              onEventClick={(event) => setEditingEvent(event)}
              onEntryClick={(entry) => setEditingEntry(entry)}
            />
          )}
        </div>

        {isSupabaseConfigured && <TeamAvailabilitySidebar entries={filteredEntries} />}
        {showUpcoming && <UpcomingPanel tasks={tasks} entries={entries} />}
      </div>

      {/* Team reise/urlaub panel */}
      {teamFilterId && (
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users size={15} className="text-gray-400" />
            {teams.find((tm) => tm.id === teamFilterId)?.name} — {t('team.awayAndVacation')}
          </h2>
          {teamEntries.length === 0 ? (
            <p className="text-sm text-gray-400">{t('team.noAwayOrVacation')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {teamEntries.map((e) => {
                const owner = (e as CalendarEntry & { owner?: { display_name: string; avatar_color: string } }).owner
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-racing-800">
                    {owner && (
                      <span
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: owner.avatar_color }}
                      >
                        {owner.display_name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-gray-400">
                        {owner?.display_name} · {e.date}{e.endDate ? ` – ${e.endDate}` : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.type === 'urlaub' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {e.type === 'urlaub' ? t('entryTypeBadges.urlaub') : t('entryTypeBadges.reise')}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {editingTask && <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} />}

      {newTaskDate && (
        <TaskFormModal defaultDueDate={newTaskDate} onClose={() => setNewTaskDate(null)} />
      )}
      {showAddForm && (
        <CalendarEntryFormModal defaultDate={toISODate(currentDate)} onClose={() => setShowAddForm(false)} />
      )}
      {editingEvent && <CalendarEntryFormModal event={editingEvent} onClose={() => setEditingEvent(null)} />}
      {editingEntry && <CalendarEntryFormModal entry={editingEntry} onClose={() => setEditingEntry(null)} />}
    </div>
  )
}

function UpcomingPanel({ tasks, entries }: { tasks: Task[]; entries: CalendarEntry[] }) {
  const { t, i18n } = useTranslation('calendar')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const today = new Date().toISOString().slice(0, 10)
  const upcomingTasks = tasks
    .filter((tk) => !tk.completed && tk.dueDate && tk.dueDate >= today)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 8)
  const upcomingEntries = entries
    .filter((e) => e.date >= today)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      return (a.startTime ?? '') < (b.startTime ?? '') ? -1 : 1
    })
    .slice(0, 8)

  const priorityColors: Record<string, string> = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-blue-400' }

  return (
    <div className="w-64 flex-shrink-0 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
      <div className="mb-3 flex items-center gap-1.5">
        <ListTodo size={14} className="text-accent" />
        <h3 className="text-sm font-semibold">{t('absence.upcoming')}</h3>
      </div>
      <div className="space-y-3">
        {upcomingEntries.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t('absence.appointments')}</p>
            <div className="space-y-1">
              {upcomingEntries.map((e) => (
                <div key={e.id} className="rounded-lg bg-gray-50 px-2.5 py-1.5 dark:bg-racing-800">
                  <p className="text-xs font-medium truncate">{e.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {format(new Date(e.date), 'EEE d. MMM', { locale: dateLocale })}
                    {e.startTime && ` · ${e.startTime}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {upcomingTasks.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t('absence.tasks')}</p>
            <div className="space-y-1">
              {upcomingTasks.map((tk) => (
                <div key={tk.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 dark:bg-racing-800">
                  <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${priorityColors[tk.priority] ?? 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{tk.title}</p>
                    {tk.dueDate && <p className="text-[10px] text-gray-400">{format(new Date(tk.dueDate), 'EEE d. MMM', { locale: dateLocale })}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {upcomingEntries.length === 0 && upcomingTasks.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">{t('absence.nothing')}</p>
        )}
      </div>
    </div>
  )
}
