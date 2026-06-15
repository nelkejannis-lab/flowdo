import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Plus, Clock, CalendarClock } from 'lucide-react'
import { useTasksStore } from '../store/tasksStore'
import { useBoardsStore } from '../store/boardsStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { useWorkTimeStore } from '../store/workTimeStore'
import { useEventsStore } from '../store/eventsStore'
import TaskList from '../components/tasks/TaskList'
import TaskFormModal from '../components/tasks/TaskFormModal'
import BoardCard from '../components/boards/BoardCard'
import { isDueThisWeek, isDueToday, isOverdue, todayISO } from '../utils/date'
import { formatHM, netMinutes } from '../utils/worktime'

export default function Dashboard() {
  const tasks = useTasksStore((s) => s.tasks)
  const fetchTasks = useTasksStore((s) => s.fetchAll)
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const fetchMyProjectTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const workEntries = useWorkTimeStore((s) => s.entries)
  const fetchWorkTime = useWorkTimeStore((s) => s.fetchAll)
  const events = useEventsStore((s) => s.events)
  const fetchEvents = useEventsStore((s) => s.fetchAll)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchBoards()
    if (isSupabaseConfigured) {
      fetchMyProjectTasks()
      fetchTasks()
      fetchEvents()
      fetchWorkTime()
    }
  }, [fetchBoards, fetchMyProjectTasks, fetchTasks, fetchEvents, fetchWorkTime])

  const allTasks = [...tasks, ...myProjectTasks]

  const weekTasks = allTasks.filter(
    (t) => !t.completed && (isOverdue(t.dueDate) || isDueToday(t.dueDate) || isDueThisWeek(t.dueDate))
  )

  const upcomingBoards = boards
    .filter((b) => b.deadline && !isOverdue(b.deadline))
    .sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1))
    .slice(0, 3)

  const today = todayISO()
  const upcomingEvents = events
    .filter((e) => e.date >= today || (e.endDate && e.endDate >= today))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 3)

  const workedMinutesToday = netMinutes(workEntries[todayISO()])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={16} />
          Aufgabe
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Diese Woche fällig</p>
          <p className="mt-1 text-3xl font-bold">{weekTasks.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Aktive Projekte</p>
          <p className="mt-1 text-3xl font-bold">{boards.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
            <Clock size={14} className="text-accent" />
            Gearbeitete Zeit heute
          </p>
          <p className="mt-1 text-3xl font-bold">{formatHM(workedMinutesToday)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Diese Woche fällig</h2>
            <Link to="/tasks/week" className="text-sm font-medium text-accent hover:underline">
              Alle anzeigen
            </Link>
          </div>
          <TaskList tasks={weekTasks} groupByDate emptyMessage="Keine Aufgaben diese Woche fällig – gut gemacht!" />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Anstehende Deadlines</h2>
              <Link to="/projekte" className="text-sm font-medium text-accent hover:underline">
                Alle Projekte
              </Link>
            </div>
            {upcomingBoards.length === 0 ? (
              <p className="text-sm text-gray-400">Keine anstehenden Deadlines</p>
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
              <h2 className="text-lg font-semibold">Arbeitszeit-Tracker</h2>
              <Link
                to="/arbeitszeit"
                className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              >
                <Clock size={14} />
                Zeit erfassen
              </Link>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-500 dark:border-racing-800 dark:bg-racing-900 dark:text-racing-200">
              {workedMinutesToday > 0 ? (
                <p>
                  Du hast heute bereits <strong className="text-gray-900 dark:text-white">{formatHM(workedMinutesToday)}</strong> gearbeitet. Weiter so!
                </p>
              ) : (
                <p>Heute noch keine Arbeitszeit erfasst. Starte jetzt einen Timer.</p>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Nächste Events</h2>
              <Link to="/calendar" className="text-sm font-medium text-accent hover:underline">
                Kalender
              </Link>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-gray-400">Keine anstehenden Events</p>
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
                          {format(parseISO(event.date), 'd. MMM yyyy', { locale: de })}
                          {event.endDate && event.endDate > event.date
                            ? ` – ${format(parseISO(event.endDate), 'd. MMM yyyy', { locale: de })}`
                            : ''}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-sm font-semibold text-accent">
                        {days < 0 ? 'läuft' : days === 0 ? 'Heute' : days === 1 ? 'Morgen' : `in ${days} Tagen`}
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
          <h2 className="text-lg font-semibold">Projekte-Übersicht</h2>
          <Link to="/projekte" className="text-sm font-medium text-accent hover:underline">
            Alle Projekte
          </Link>
        </div>
        {boards.length === 0 ? (
          <p className="text-sm text-gray-400">Noch keine Projekte angelegt</p>
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
