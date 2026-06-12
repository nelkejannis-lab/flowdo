import { useEffect, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  format,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'
import { de } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
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
import type { CalendarEntry, CalendarEvent, Task } from '../types'

type ViewMode = 'month' | 'week' | 'day'

export default function CalendarPage() {
  const tasks = useTasksStore((s) => s.tasks)
  const events = useEventsStore((s) => s.events)
  const entries = useCalendarEntriesStore((s) => s.entries)
  const fetchEntries = useCalendarEntriesStore((s) => s.fetchEntries)
  const [view, setView] = useState<ViewMode>('month')
  const [currentDate, setCurrentDate] = useState(new Date())
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [newTaskDate, setNewTaskDate] = useState<string | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    if (isSupabaseConfigured) fetchEntries()
  }, [fetchEntries])

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
      ? format(currentDate, 'MMMM yyyy', { locale: de })
      : view === 'week'
      ? `Woche vom ${format(currentDate, 'd. MMM', { locale: de })}`
      : format(currentDate, 'd. MMMM yyyy', { locale: de })

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
            Heute
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
              {v === 'month' ? 'Monat' : v === 'week' ? 'Woche' : 'Tag'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={14} />
          Hinzufügen
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              tasks={tasks}
              events={events}
              entries={entries}
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
              entries={entries}
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
              entries={entries}
              onAddTask={() => setNewTaskDate(toISODate(currentDate))}
              onEventClick={(event) => setEditingEvent(event)}
              onEntryClick={(entry) => setEditingEntry(entry)}
            />
          )}
        </div>

        {isSupabaseConfigured && <TeamAvailabilitySidebar entries={entries} />}
      </div>

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
