import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { Plus, Clock, CalendarClock, Play, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTasksStore } from '../store/tasksStore'
import { useBoardsStore } from '../store/boardsStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { useWorkTimeStore } from '../store/workTimeStore'
import { useEventsStore } from '../store/eventsStore'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import CalendarEntriesBlock from '../components/calendar/CalendarEntriesBlock'
import TaskList from '../components/tasks/TaskList'
import TaskFormModal from '../components/tasks/TaskFormModal'
import BoardCard from '../components/boards/BoardCard'
import { isDueThisWeek, isDueToday, isOverdue, todayISO } from '../utils/date'
import { formatHM, netMinutes } from '../utils/worktime'

export default function Dashboard() {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const tasks = useTasksStore((s) => s.tasks)
  const fetchTasks = useTasksStore((s) => s.fetchAll)
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const fetchMyProjectTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const workEntries = useWorkTimeStore((s) => s.entries)
  const fetchWorkTime = useWorkTimeStore((s) => s.fetchAll)
  const isWorkTimeRunning = useWorkTimeStore((s) => s.isRunning)
  const runningStartedAt = useWorkTimeStore((s) => s.runningStartedAt)
  const clockIn = useWorkTimeStore((s) => s.clockIn)
  const clockOut = useWorkTimeStore((s) => s.clockOut)
  const events = useEventsStore((s) => s.events)
  const fetchEvents = useEventsStore((s) => s.fetchAll)
  const calendarEntries = useCalendarEntriesStore((s) => s.entries)
  const fetchCalendarEntries = useCalendarEntriesStore((s) => s.fetchEntries)
  const [showForm, setShowForm] = useState(false)
  const [showEntries, setShowEntries] = useState(true)
  const [showWeekEntries, setShowWeekEntries] = useState(true)

  useEffect(() => {
    fetchBoards()
    if (isSupabaseConfigured) {
      fetchMyProjectTasks()
      fetchTasks()
      fetchEvents()
      fetchCalendarEntries()
      fetchWorkTime()
    }
  }, [fetchBoards, fetchMyProjectTasks, fetchTasks, fetchEvents, fetchCalendarEntries, fetchWorkTime])

  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!isWorkTimeRunning) return
    const interval = setInterval(() => forceTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [isWorkTimeRunning])

  const allTasks = [...tasks, ...myProjectTasks]

  const weekTasks = allTasks.filter(
    (t) => !t.completed && (isOverdue(t.dueDate) || isDueToday(t.dueDate) || isDueThisWeek(t.dueDate))
  )

  const upcomingBoards = boards
    .filter((b) => b.deadline && !isOverdue(b.deadline))
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
    .slice(0, 3)

  const today = todayISO()

  const weekEndDate = (() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? 0 : 7 - day
    const end = new Date(d)
    end.setDate(d.getDate() + diff)
    return end.toISOString().slice(0, 10)
  })()

  const weekEntries = calendarEntries
    .filter((e) => e.date > today && e.date <= weekEndDate && (!e.endDate || e.endDate >= today))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const todayEntries = calendarEntries.filter(
    (e) => e.date <= today && (!e.endDate || e.endDate >= today)
  ).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const upcomingEvents = events
    .filter((e) => e.date >= today || (e.endDate && e.endDate >= today))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 3)

  const liveMinutes =
    isWorkTimeRunning && runningStartedAt ? (Date.now() - new Date(runningStartedAt).getTime()) / 60000 : 0
  const workedMinutesToday = netMinutes(workEntries[todayISO()]) + liveMinutes

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={16} />
          {t('addTask')}
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('stats.dueThisWeek')}</p>
          <p className="mt-1 text-3xl font-bold">{weekTasks.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{t('stats.activeProjects')}</p>
          <p className="mt-1 text-3xl font-bold">{boards.length}</p>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
              <Clock size={14} className="text-accent" />
              {t('stats.workedToday')}
            </p>
            <p className="mt-1 text-3xl font-bold">{formatHM(workedMinutesToday)}</p>
          </div>
          <button
            onClick={isWorkTimeRunning ? clockOut : clockIn}
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white shadow ${
              isWorkTimeRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-accent hover:bg-accent-dark'
            }`}
            title={isWorkTimeRunning ? t('clockOut') : t('clockIn')}
          >
            {isWorkTimeRunning ? <Square size={16} /> : <Play size={18} className="ml-0.5" />}
          </button>
        </div>
      </div>

      {(todayEntries.length > 0 || allTasks.some((tk) => !tk.completed && (isDueToday(tk.dueDate) || isOverdue(tk.dueDate)))) && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('sections.todayCalendar')}</h2>
            <div className="flex items-center gap-3">
              {todayEntries.length > 0 && (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400">
                  <span>Termine</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showEntries}
                    onClick={() => setShowEntries((v) => !v)}
                    className={`relative h-6 w-11 flex-shrink-0 overflow-hidden rounded-full transition-colors ${showEntries ? 'bg-accent' : 'bg-gray-200 dark:bg-racing-700'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showEntries ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              )}
              <Link to="/tasks/today" className="text-sm font-medium text-accent hover:underline">
                {t('showAll')}
              </Link>
            </div>
          </div>
          {showEntries && <CalendarEntriesBlock entries={todayEntries} label="Termine heute" today={today} />}
          <TaskList
            tasks={allTasks.filter((tk) => !tk.completed && (isDueToday(tk.dueDate) || isOverdue(tk.dueDate)))}
            emptyMessage=""
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('sections.dueThisWeek')}</h2>
            <div className="flex items-center gap-3">
              {weekEntries.length > 0 && (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400">
                  <span>Termine</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showWeekEntries}
                    onClick={() => setShowWeekEntries((v) => !v)}
                    className={`relative h-6 w-11 flex-shrink-0 overflow-hidden rounded-full transition-colors ${showWeekEntries ? 'bg-accent' : 'bg-gray-200 dark:bg-racing-700'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showWeekEntries ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                  </button>
                </label>
              )}
              <Link to="/tasks/week" className="text-sm font-medium text-accent hover:underline">
                {t('showAll')}
              </Link>
            </div>
          </div>
          {showWeekEntries && <CalendarEntriesBlock entries={weekEntries} label="Termine diese Woche" today={today} />}
          <TaskList tasks={weekTasks} groupByDate emptyMessage={t('noTasksThisWeek')} />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('sections.upcomingDeadlines')}</h2>
              <Link to="/projekte" className="text-sm font-medium text-accent hover:underline">
                {t('allProjects')}
              </Link>
            </div>
            {upcomingBoards.length === 0 ? (
              <p className="text-sm text-gray-400">{t('noUpcomingDeadlines')}</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {upcomingBoards.map((board) => (
                  <BoardCard key={board.id} board={board} />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('sections.upcomingEvents')}</h2>
              <Link to="/calendar" className="text-sm font-medium text-accent hover:underline">
                {t('calendar')}
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-gray-400">{t('noUpcomingEvents')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {upcomingEvents.map((event) => {
                  const days = differenceInCalendarDays(parseISO(event.date), parseISO(today))
                  return (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
                    >
                      <span
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: event.color }}
                      >
                        <CalendarClock size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-gray-400">
                          {format(parseISO(event.date), 'd. MMM yyyy', { locale: dateLocale })}
                          {event.endDate && event.endDate > event.date
                            ? ` – ${format(parseISO(event.endDate), 'd. MMM yyyy', { locale: dateLocale })}`
                            : ''}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-sm font-semibold text-accent">
                        {days < 0 ? t('eventStatus.ongoing') : days === 0 ? t('eventStatus.today') : days === 1 ? t('eventStatus.tomorrow') : t('eventStatus.inDays', { count: days })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('sections.projectsOverview')}</h2>
          <Link to="/projekte" className="text-sm font-medium text-accent hover:underline">
            {t('allProjects')}
          </Link>
        </div>
        {boards.length === 0 ? (
          <p className="text-sm text-gray-400">{t('noProjectsYet')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <BoardCard key={board.id} board={board} />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <TaskFormModal defaultDueDate={todayISO()} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}
