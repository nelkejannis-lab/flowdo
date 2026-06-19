import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSocialStore } from '../store/socialStore'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { Plus, CalendarClock, Instagram, TrendingUp, Heart, Bookmark, Users } from 'lucide-react'
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
import WeatherWidget from '../components/dashboard/WeatherWidget'
import WorkOfficeWidget from '../components/office/WorkOfficeWidget'
import OfficePromptModal from '../components/office/OfficePromptModal'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripHorizontal } from 'lucide-react'
import OnboardingPermissions from '../components/dashboard/OnboardingPermissions'
import MorningReportModal from '../components/dashboard/MorningReportModal'
import { useSettingsStore } from '../store/settingsStore'
import { isDueThisWeek, isDueToday, isOverdue, todayISO } from '../utils/date'

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
  const events = useEventsStore((s) => s.events)
  const fetchEvents = useEventsStore((s) => s.fetchAll)
  const calendarEntries = useCalendarEntriesStore((s) => s.entries)
  const fetchCalendarEntries = useCalendarEntriesStore((s) => s.fetchEntries)
  const socialAccounts = useSocialStore((s) => s.accounts)
  const socialMetrics = useSocialStore((s) => s.metrics)
  const socialPosts = useSocialStore((s) => s.posts)
  const fetchSocialAccounts = useSocialStore((s) => s.fetchAccounts)
  const fetchSocialAccountData = useSocialStore((s) => s.fetchAccountData)
  const featureVisibility = useSettingsStore((s) => s.featureVisibility)
  const dashboardVisibility = useSettingsStore((s) => s.dashboardVisibility)
  const onboardingPermissionsDone = useSettingsStore((s) => s.onboardingPermissionsDone)
  const [showForm, setShowForm] = useState(false)
  const [showEntries, setShowEntries] = useState(true)
  const [showWeekEntries, setShowWeekEntries] = useState(true)
  const [showMorningReport, setShowMorningReport] = useState(() => {
    const hour = new Date().getHours()
    const today = new Date().toISOString().slice(0, 10)
    const dismissed = localStorage.getItem('morningReportDismissed')
    return hour >= 5 && hour < 12 && dismissed !== today
  })
  const DEFAULT_WIDGET_ORDER = ['weather', 'workoffice', 'stats_week', 'stats_projects']
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dashWidgetOrder') ?? 'null') ?? DEFAULT_WIDGET_ORDER } catch { return DEFAULT_WIDGET_ORDER }
  })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  function handleWidgetDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (over && active.id !== over.id) {
      setWidgetOrder((prev) => {
        const next = arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id)))
        localStorage.setItem('dashWidgetOrder', JSON.stringify(next))
        return next
      })
    }
  }

  useEffect(() => {
    fetchBoards()
    if (isSupabaseConfigured) {
      fetchMyProjectTasks()
      fetchTasks()
      fetchEvents()
      fetchCalendarEntries()
      fetchWorkTime()
      fetchSocialAccounts()
    }
  }, [fetchBoards, fetchMyProjectTasks, fetchTasks, fetchEvents, fetchCalendarEntries, fetchWorkTime, fetchSocialAccounts])

  useEffect(() => {
    socialAccounts.forEach((a) => fetchSocialAccountData(a.id))
  }, [socialAccounts, fetchSocialAccountData])

  const allTasks = [...tasks, ...myProjectTasks]

  function eisenhowerRank(t: { urgent: boolean; important: boolean; priority: string }): number {
    if (t.urgent && t.important) return 0
    if (!t.urgent && t.important) return 1
    if (t.urgent && !t.important) return 2
    return 3
  }
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 }

  function sortByEisenhower<T extends { urgent: boolean; important: boolean; priority: string }>(arr: T[]): T[] {
    return [...arr].sort((a, b) =>
      eisenhowerRank(a) - eisenhowerRank(b) || (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1)
    )
  }

  // "Diese Woche" = all non-completed tasks this week incl. today (overdue excluded)
  const weekTasks = sortByEisenhower(
    allTasks.filter((t) => !t.completed && isDueThisWeek(t.dueDate) && !isOverdue(t.dueDate))
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

  const nowTime = new Date().toTimeString().slice(0, 5)
  const todayEntries = calendarEntries.filter((e) => {
    // Only show entries that are today or multi-day events spanning today
    const isToday = e.date === today
    const isMultiDaySpanningToday = e.date < today && e.endDate && e.endDate >= today
    if (!isToday && !isMultiDaySpanningToday) return false
    // Hide today's entries whose end time has already passed
    if (isToday) {
      const endT = e.endTime ?? e.startTime
      if (endT && endT < nowTime) return false
    }
    return true
  }).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const upcomingEvents = events
    .filter((e) => e.date >= today || (e.endDate && e.endDate >= today))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 3)

  return (
    <div>
      <OfficePromptModal />
      {showMorningReport && (
        <MorningReportModal
          todayTasks={allTasks.filter((t) => !t.completed && (isDueToday(t.dueDate) || isOverdue(t.dueDate)))}
          weekTasks={weekTasks}
          todayEntries={todayEntries}
          weekEntries={weekEntries}
          onClose={() => {
            setShowMorningReport(false)
            localStorage.setItem('morningReportDismissed', new Date().toISOString().slice(0, 10))
          }}
        />
      )}
      {!onboardingPermissionsDone && <OnboardingPermissions />}
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

      {/* Widget grid — rendered after task sections via CSS order */}

      {false && socialAccounts.length > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {socialAccounts.slice(0, 3).map((account) => {
              const mList = socialMetrics[account.id] ?? []
              const latest = mList[mList.length - 1]
              const prev = mList[mList.length - 2]
              const follDelta = latest && prev && prev.followersCount != null && latest.followersCount != null
                ? latest.followersCount - prev.followersCount : null
              const fmt = (n?: number | null) => n == null ? '–' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n)
              const acctPosts = socialPosts[account.id] ?? []
              const postLikes = acctPosts.reduce((s, p) => s + (p.likeCount ?? 0), 0)
              const postSaves = acctPosts.reduce((s, p) => s + (p.saved ?? 0), 0)
              const displayLikes = latest?.likes ?? (acctPosts.length ? postLikes : null)
              const displaySaves = latest?.saves ?? (acctPosts.length ? postSaves : null)
              return (
                <Link key={account.id} to={`/social/${account.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow dark:border-racing-800 dark:bg-racing-900"
                >
                  <div className="flex items-center gap-3">
                    {account.profilePictureUrl
                      ? <img src={account.profilePictureUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-full object-cover ring-2 ring-pink-200" />
                      : <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 text-white"><Instagram size={16} /></span>
                    }
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-sm">@{account.username}</p>
                      {follDelta !== null && (
                        <p className={`text-xs flex items-center gap-0.5 ${follDelta >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                          <TrendingUp size={11} />
                          {follDelta >= 0 ? '+' : ''}{follDelta} Follower
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400 flex items-center justify-center gap-0.5"><Users size={9} />Follower</p>
                      <p className="text-xs font-bold">{fmt(latest?.followersCount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400">Reach</p>
                      <p className="text-xs font-bold">{fmt(latest?.reach)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400 flex items-center justify-center gap-0.5"><Heart size={9} />Likes</p>
                      <p className="text-xs font-bold">{fmt(displayLikes)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] text-gray-400 flex items-center justify-center gap-0.5"><Bookmark size={9} />Saves</p>
                      <p className="text-xs font-bold">{fmt(displaySaves)}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {dashboardVisibility.todayTasks && (todayEntries.length > 0 || allTasks.some((tk) => !tk.completed && (isDueToday(tk.dueDate) || isOverdue(tk.dueDate)))) && (
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
                    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${showEntries ? 'bg-[#34c759]' : 'bg-gray-200 dark:bg-racing-700'}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showEntries ? 'translate-x-5' : 'translate-x-0'}`} />
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
            tasks={sortByEisenhower(allTasks.filter((tk) => !tk.completed && (isDueToday(tk.dueDate) || isOverdue(tk.dueDate))))}
            emptyMessage=""
          />
        </div>
      )}

      {dashboardVisibility.upcomingDeadlines !== false && (weekTasks.length > 0 || weekEntries.length > 0) && (
        <div className="mb-6">
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
                    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${showWeekEntries ? 'bg-[#34c759]' : 'bg-gray-200 dark:bg-racing-700'}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${showWeekEntries ? 'translate-x-5' : 'translate-x-0'}`} />
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
      )}

      {/* ── Drag & Drop Widget Grid ── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleWidgetDragEnd}>
        <SortableContext items={widgetOrder} strategy={horizontalListSortingStrategy}>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {widgetOrder.map((id) => {
              if (id === 'weather' && (dashboardVisibility.weather ?? true)) return (
                <SortableWidget key="weather" id="weather"><WeatherWidget /></SortableWidget>
              )
              if (id === 'workoffice') return (
                <SortableWidget key="workoffice" id="workoffice"><WorkOfficeWidget /></SortableWidget>
              )
              if (id === 'stats_week' && (dashboardVisibility.stats ?? true)) return (
                <SortableWidget key="stats_week" id="stats_week">
                  <Link to="/tasks/week" className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 h-full hover:border-accent/30 hover:shadow-sm transition-all dark:border-racing-800 dark:bg-racing-900">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('stats.dueThisWeek')}</span>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold tabular-nums leading-none">{weekTasks.length}</span>
                      <span className="mb-1 text-sm text-gray-400">Aufgaben</span>
                    </div>
                    <div className="mt-auto flex flex-col gap-1">
                      {weekTasks.slice(0, 3).map((tk) => (
                        <div key={tk.id} className="flex items-center gap-1.5 truncate text-xs text-gray-500">
                          <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${tk.priority === 'high' ? 'bg-red-400' : tk.priority === 'medium' ? 'bg-amber-400' : 'bg-gray-300'}`} />
                          <span className="truncate">{tk.title}</span>
                        </div>
                      ))}
                      {weekTasks.length > 3 && <span className="text-[10px] text-gray-400">+{weekTasks.length - 3} weitere</span>}
                    </div>
                  </Link>
                </SortableWidget>
              )
              if (id === 'stats_projects' && (dashboardVisibility.stats ?? true)) return (
                <SortableWidget key="stats_projects" id="stats_projects">
                  <Link to="/projekte" className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 h-full hover:border-accent/30 hover:shadow-sm transition-all dark:border-racing-800 dark:bg-racing-900">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('stats.activeProjects')}</span>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold tabular-nums leading-none">{boards.length}</span>
                      <span className="mb-1 text-sm text-gray-400">Projekte</span>
                    </div>
                    <div className="mt-auto flex flex-col gap-1">
                      {boards.slice(0, 3).map((b) => (
                        <div key={b.id} className="flex items-center gap-1.5 truncate text-xs text-gray-500">
                          <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: b.color ?? '#6366f1' }} />
                          <span className="truncate">{b.title}</span>
                        </div>
                      ))}
                      {boards.length > 3 && <span className="text-[10px] text-gray-400">+{boards.length - 3} weitere</span>}
                    </div>
                  </Link>
                </SortableWidget>
              )
              return null
            })}
          </div>
        </SortableContext>
      </DndContext>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          {dashboardVisibility.upcomingDeadlines && <div>
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
          </div>}

          {dashboardVisibility.nextEvents && <div>
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
          </div>}
        </div>
      </div>

      {dashboardVisibility.projectsOverview && <div className="mt-6">
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
      </div>}

      {showForm && (
        <TaskFormModal defaultDueDate={todayISO()} onClose={() => setShowForm(false)} />
      )}
    </div>
  )
}

function SortableWidget({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className="relative group flex flex-col"
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute right-2 top-2 z-10 cursor-grab rounded p-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-80 active:cursor-grabbing touch-none"
        title="Verschieben"
        tabIndex={-1}
      >
        <GripHorizontal size={13} className="text-gray-500" />
      </button>
      {children}
    </div>
  )
}
