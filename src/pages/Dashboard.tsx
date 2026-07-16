import React, { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSocialStore } from '../store/socialStore'
import { differenceInCalendarDays, format, parseISO, addDays, startOfWeek, isSameDay } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { Plus, CalendarClock, Instagram, TrendingUp, Heart, Bookmark, Users, Loader2, Sliders, Check, X, Sparkles, Flame, Star, ArrowRight, BarChart3 } from 'lucide-react'
import type { Task, CalendarEntry } from '../types'
import { useAiSchedulerStore } from '../store/aiSchedulerStore'
import { useFriendsStore } from '../store/friendsStore'
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
import ProjectTaskFormModal from '../components/boards/ProjectTaskFormModal'
import BoardCard from '../components/boards/BoardCard'
import AiDayPlannerModal from '../components/dashboard/AiDayPlannerModal'
import WeeklyReportModal from '../components/dashboard/WeeklyReportModal'
import DayPlanWidget from '../components/dashboard/DayPlanWidget'
import WeatherWidget from '../components/dashboard/WeatherWidget'
import CalendarEntryFormModal from '../components/calendar/CalendarEntryFormModal'
import WorkOfficeWidget from '../components/office/WorkOfficeWidget'
import OfficePromptModal from '../components/office/OfficePromptModal'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripHorizontal } from 'lucide-react'
import OnboardingPermissions from '../components/dashboard/OnboardingPermissions'
import OnboardingWizard from '../components/onboarding/OnboardingWizard'
import MorningReportModal from '../components/dashboard/MorningReportModal'
import TodayHero from '../components/dashboard/TodayHero'
import WeeklyInsightCard from '../components/dashboard/WeeklyInsightCard'
import { DayCapacityWidget, WeekOverviewWidget } from '../components/dashboard/FocusWidgets'
import { useSettingsStore, DEFAULT_DASHBOARD_WIDGET_ORDER } from '../store/settingsStore'
import { isDueThisWeek, isDueToday, isOverdue, todayISO, parseNaturalDate, parseTaskInput, parseAppointmentInput, isCompletedToday } from '../utils/date'
import { useQuickTaskModalStore } from '../store/quickTaskModalStore'
import { useOfficeStore } from '../store/officeStore'
import { dayTargetMinutes, formatHM, netMinutes } from '../utils/worktime'
import { computeDayReadiness, computeWeeklyInsight } from '../lib/dayReadiness'

function isLikelyAppointment(input: string): boolean {
  const lower = input.toLowerCase()
  return /\b(termin|meeting|besprechung|call|zoom|teams|interview|arzt)\b/.test(lower)
    || /\d{1,2}[:.]\d{2}/.test(input)
    || /\bum\s+\d{1,2}/.test(lower)
}

export default function Dashboard() {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const tasks = useTasksStore((s) => s.tasks)
  const fetchTasks = useTasksStore((s) => s.fetchAll)
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const myProjectTasks = useProjectTasksStore((s) => s.myTasks)
  const fetchMyProjectTasks = useProjectTasksStore((s) => s.fetchMyTasks)
  const subscribeToMyProjectTasks = useProjectTasksStore((s) => s.subscribeToMyTasks)
  const toggleTaskCompleted = useTasksStore((s) => s.toggleTaskCompleted)
  const toggleProjectTaskCompleted = useProjectTasksStore((s) => s.toggleTaskCompleted)
  const workEntries = useWorkTimeStore((s) => s.entries)
  const fetchWorkTime = useWorkTimeStore((s) => s.fetchAll)
  const workSettings = useWorkTimeStore((s) => s.settings)
  const isRunning = useWorkTimeStore((s) => s.isRunning)
  const runningStartedAt = useWorkTimeStore((s) => s.runningStartedAt)
  const colleagueEntries = useOfficeStore((s) => s.colleagueEntries)
  const todayOffice = useOfficeStore((s) => s.todayEntry)
  const fetchOfficeToday = useOfficeStore((s) => s.fetchToday)
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
  const toggleDashboardWidget = useSettingsStore((s) => s.toggleDashboardWidget)
  const onboardingPermissionsDone = useSettingsStore((s) => s.onboardingPermissionsDone)
  const onboardingTourDone = useSettingsStore((s) => s.onboardingTourDone)
  const openQuickTaskModal = useQuickTaskModalStore((s) => s.open)
  const [showForm, setShowForm] = useState(false)
  const [showAiDayPlanner, setShowAiDayPlanner] = useState(false)
  const [showWeekReport, setShowWeekReport] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editingEntry, setEditingEntry] = useState<CalendarEntry | undefined>()
  const [showEntryForm, setShowEntryForm] = useState(false)
  const [newTaskForToday, setNewTaskForToday] = useState(false)
  const [quickInput, setQuickInput] = useState('')
  const [parsingTask, setParsingTask] = useState(false)
  const [quickEntryDefaults, setQuickEntryDefaults] = useState<{
    title?: string
    description?: string
    date?: string
    endDate?: string
    startTime?: string
    endTime?: string
    invitedUserIds?: string[]
  } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showEntries, setShowEntries] = useState(true)
  const [showWeekEntries, setShowWeekEntries] = useState(true)
  const [showMorningReport, setShowMorningReport] = useState(() => {
    const hour = new Date().getHours()
    const today = new Date().toISOString().slice(0, 10)
    const dismissed = localStorage.getItem('morningReportDismissed')
    return hour >= 5 && hour < 12 && dismissed !== today
  })
  const widgetOrder = useSettingsStore((s) => s.dashboardWidgetOrder ?? DEFAULT_DASHBOARD_WIDGET_ORDER)
  const setWidgetOrder = useSettingsStore((s) => s.setDashboardWidgetOrder)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  function handleWidgetDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (over && active.id !== over.id) {
      const oldIndex = widgetOrder.indexOf(String(active.id))
      const newIndex = widgetOrder.indexOf(String(over.id))
      if (oldIndex !== -1 && newIndex !== -1) {
        setWidgetOrder(arrayMove(widgetOrder, oldIndex, newIndex))
      }
    }
  }

  useEffect(() => {
    fetchBoards()
    fetchOfficeToday()
    if (isSupabaseConfigured) {
      fetchMyProjectTasks()
      fetchTasks()
      fetchEvents()
      fetchCalendarEntries()
      fetchWorkTime()
      fetchSocialAccounts()
    }
  }, [fetchBoards, fetchMyProjectTasks, fetchTasks, fetchEvents, fetchCalendarEntries, fetchWorkTime, fetchSocialAccounts, fetchOfficeToday])

  useEffect(() => {
    socialAccounts.forEach((a) => fetchSocialAccountData(a.id))
  }, [socialAccounts, fetchSocialAccountData])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    return subscribeToMyProjectTasks()
  }, [subscribeToMyProjectTasks])

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

  const todayOpenTasks = allTasks.filter((tk) => !tk.completed && (isDueToday(tk.dueDate) || isOverdue(tk.dueDate)))
  const topPriorities = sortByEisenhower(
    allTasks.filter((tk) => !tk.completed && tk.urgent && tk.important)
  ).slice(0, 3)
  const nextEvent = todayEntries[0]
    ? { id: todayEntries[0].id, title: todayEntries[0].title, startTime: todayEntries[0].startTime ?? undefined, date: todayEntries[0].date }
    : null

  const todayWork = workEntries[today]
  const liveMin = isRunning && runningStartedAt ? (Date.now() - new Date(runningStartedAt).getTime()) / 60000 : 0
  const workedMin = netMinutes(todayWork) + liveMin
  const targetMin = dayTargetMinutes(new Date(), workSettings)
  const capacityPercent = targetMin > 0 ? Math.min(100, (workedMin / targetMin) * 100) : 0
  const colleagues = colleagueEntries.map((c) => ({
    id: c.userId,
    name: c.displayName ?? '?',
    avatarUrl: c.avatarUrl,
  }))
  const meetingMinutesToday = todayEntries.reduce((sum, e) => {
    if (!e.startTime || !e.endTime) return sum + 30
    const [sh, sm] = e.startTime.split(':').map(Number)
    const [eh, em] = e.endTime.split(':').map(Number)
    return sum + Math.max(0, eh * 60 + em - (sh * 60 + sm))
  }, 0)
  const workStatusLabel = todayOffice?.location === 'homeoffice'
    ? t('officeWidget.homeoffice')
    : todayOffice?.location === 'office'
      ? t('officeWidget.office')
      : isRunning
        ? t('officeWidget.running')
        : null
  const dayLabel = format(new Date(), 'EEEE, d. MMMM', { locale: dateLocale })

  const readiness = useMemo(
    () =>
      computeDayReadiness({
        tasks: allTasks,
        capacityPercent,
        meetingMinutes: meetingMinutesToday,
        targetMinutes: targetMin,
        hasWorkStatus: !!todayOffice?.location,
        isWorkRunning: isRunning,
        openTodayCount: todayOpenTasks.length,
        nextEventTitle: nextEvent?.title ?? null,
      }),
    [
      allTasks,
      capacityPercent,
      meetingMinutesToday,
      targetMin,
      todayOffice?.location,
      isRunning,
      todayOpenTasks.length,
      nextEvent?.title,
    ],
  )

  const weekDayLoads = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(start, i)
      const iso = format(d, 'yyyy-MM-dd')
      const taskCount = allTasks.filter((tk) => !tk.completed && tk.dueDate === iso).length
      const entryCount = calendarEntries.filter((e) => {
        if (e.date === iso) return true
        if (e.endDate && e.date < iso && e.endDate >= iso) return true
        return false
      }).length
      return {
        iso,
        label: format(d, 'EEEE', { locale: dateLocale }),
        total: taskCount + entryCount,
        isToday: isSameDay(d, new Date()),
      }
    })
  }, [allTasks, calendarEntries, dateLocale])

  const weeklyInsight = useMemo(
    () => computeWeeklyInsight(allTasks, weekDayLoads),
    [allTasks, weekDayLoads],
  )

  const todayTodos = sortByEisenhower(todayOpenTasks)

  const tasksCompletedToday = allTasks.filter((tk) => tk.completed && isCompletedToday(tk.completedAt)).length
  const tasksTotalToday = tasksCompletedToday + todayOpenTasks.length
  const meetingsHeldToday = calendarEntries.filter((e) => {
    const isToday = e.date === today
    const isMultiDaySpanningToday = e.date < today && e.endDate && e.endDate >= today
    if (!isToday && !isMultiDaySpanningToday) return false
    if (!isToday) return false
    const endT = e.endTime ?? e.startTime
    return !!endT && endT < nowTime
  }).length
  const doneStats = {
    tasksCompleted: tasksCompletedToday,
    tasksTotal: tasksTotalToday,
    meetingsHeld: meetingsHeldToday,
    trackedLabel: formatHM(workedMin),
  }

  return (
    <div>
      <OfficePromptModal />
      {showMorningReport && (
        <MorningReportModal
          todayTasks={todayOpenTasks}
          weekTasks={weekTasks}
          todayEntries={todayEntries}
          weekEntries={weekEntries}
          capacityPercent={capacityPercent}
          workedLabel={formatHM(workedMin)}
          targetLabel={formatHM(targetMin)}
          colleagues={colleagues}
          onPlanDay={() => setShowAiDayPlanner(true)}
          onClose={() => {
            setShowMorningReport(false)
            localStorage.setItem('morningReportDismissed', new Date().toISOString().slice(0, 10))
          }}
        />
      )}
      {!onboardingTourDone && <OnboardingWizard />}
      {!onboardingPermissionsDone && <OnboardingPermissions />}

      {/* Sticky Quick Add — always pinned to top of main scrollport for fast add */}
      <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-gray-100/80 bg-white/95 px-4 py-3 shadow-sm shadow-black/[0.04] backdrop-blur-md dark:border-racing-850/80 dark:bg-[rgb(var(--surface-0)/0.95)] dark:shadow-black/20 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const input = quickInput.trim()
            if (!input || parsingTask) return
            setParsingTask(true)
            try {
              if (isLikelyAppointment(input)) {
                let parsed
                try {
                  const friendsStore = useFriendsStore.getState()
                  if (friendsStore.friends.length === 0) await friendsStore.fetchAll()
                  const colleagues = useFriendsStore.getState().friends.map((f) => ({
                    id: f.profile.id,
                    name: f.profile.display_name,
                  }))
                  parsed = await useAiSchedulerStore.getState().parseAppointment(input, colleagues)
                } catch (err) {
                  console.error('AI appointment parsing failed, falling back to regex:', err)
                  const fallback = parseAppointmentInput(input)
                  parsed = {
                    title: fallback.title,
                    description: null,
                    date: fallback.date ?? todayISO(),
                    endDate: fallback.endDate ?? null,
                    startTime: fallback.startTime ?? null,
                    endTime: fallback.endTime ?? null,
                    colleagueIds: [],
                  }
                }
                if (!parsed) {
                  parsed = {
                    title: input,
                    description: null,
                    date: todayISO(),
                    endDate: null,
                    startTime: null,
                    endTime: null,
                    colleagueIds: [],
                  }
                }
                setQuickEntryDefaults({
                  title: parsed.title,
                  description: parsed.description ?? undefined,
                  date: parsed.date,
                  endDate: parsed.endDate ?? undefined,
                  startTime: parsed.startTime ?? undefined,
                  endTime: parsed.endTime ?? undefined,
                  invitedUserIds: parsed.colleagueIds,
                })
                setEditingEntry(undefined)
                setShowEntryForm(true)
                setQuickInput('')
                return
              }
              let parsed
              try {
                parsed = await useAiSchedulerStore.getState().parseTaskWithAi(input, boards)
              } catch (err) {
                console.error('AI parsing failed, falling back to regex:', err)
                parsed = parseTaskInput(input, boards)
              }
              openQuickTaskModal({
                defaultTitle: parsed.title,
                defaultDueDate: parsed.dueDate,
                defaultProjectId: parsed.projectId,
                defaultPriority: parsed.priority,
                defaultUrgent: parsed.urgent,
                defaultImportant: parsed.important,
              })
              setQuickInput('')
            } finally {
              setParsingTask(false)
            }
          }}
          className="flex gap-2"
        >
          <input
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            disabled={parsingTask}
            placeholder={parsingTask ? "Analysiere mit KI..." : t('quickAddPlaceholder')}
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-accent dark:border-racing-700 dark:bg-racing-900 disabled:opacity-75"
          />
          <button
            type="submit"
            disabled={!quickInput.trim() || parsingTask}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-40 sm:px-4"
          >
            {parsingTask ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            <span className="hidden sm:inline">{parsingTask ? "Analysiere..." : t('addTask')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowWeekReport(true)}
            title={t('weekReport.title')}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-racing-700 dark:bg-racing-900 sm:px-4"
          >
            <BarChart3 size={16} />
          </button>
          <button
            type="button"
            onClick={() => setShowAiDayPlanner(true)}
            title={t('aiPlanner.title')}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110 sm:px-4"
          >
            <Sparkles size={16} />
          </button>
        </form>
      </div>

      <TodayHero
        dayLabel={dayLabel}
        nextEvent={nextEvent}
        priorities={topPriorities}
        todayTodos={todayTodos}
        capacityPercent={capacityPercent}
        workedLabel={formatHM(workedMin)}
        targetLabel={formatHM(targetMin)}
        workStatus={workStatusLabel}
        colleagues={colleagues}
        readiness={readiness}
        doneStats={doneStats}
        onPlanDay={() => setShowAiDayPlanner(true)}
        onOpenBriefing={() => setShowMorningReport(true)}
        onAddTask={() => setNewTaskForToday(true)}
        onAddEntry={() => { setQuickEntryDefaults(null); setEditingEntry(undefined); setShowEntryForm(true) }}
        onToggleTodo={(tk) => {
          if (tk.boardId) toggleProjectTaskCompleted(tk.id)
          else toggleTaskCompleted(tk.id)
        }}
        onOpenTodo={(tk) => setEditingTask(tk as typeof allTasks[number])}
      />

      <div className="mb-6">
        <WeeklyInsightCard
          insight={weeklyInsight}
          onAiRefresh={() => setShowWeekReport(true)}
        />
      </div>

      <div className="mb-6 flex items-center justify-end gap-3">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-all duration-150 active:scale-95 ${
            isEditing
              ? 'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600'
              : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.08] dark:bg-white/[0.06] dark:text-racing-200 dark:hover:bg-white/[0.1]'
          }`}
        >
          {isEditing ? (
            <>
              <Check size={14} />
              Fertig
            </>
          ) : (
            <>
              <Sliders size={14} />
              Dashboard anpassen
            </>
          )}
        </button>
      </div>

      {showAiDayPlanner && <AiDayPlannerModal onClose={() => setShowAiDayPlanner(false)} />}
      {showWeekReport && <WeeklyReportModal onClose={() => setShowWeekReport(false)} />}

      {isEditing && (
        <div className="mb-6 rounded-xl border-2 border-dashed border-gray-200 dark:border-racing-800 p-4 bg-gray-50/50 dark:bg-racing-950/20 animate-in fade-in slide-in-from-top-2 duration-150">
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">{t('sections.hiddenWidgetsTitle')}</h3>
          {(() => {
            const allDashboardItems = [
              { key: 'stats',            label: t('sections.widgetLabels.stats') },
              { key: 'workoffice',       label: t('sections.widgetLabels.workoffice') },
              { key: 'weather',          label: t('sections.widgetLabels.weather') },
              { key: 'dayPlan',          label: t('sections.widgetLabels.dayPlan') },
              { key: 'topPriority',      label: t('sections.widgetLabels.topPriority') },
              { key: 'upcomingDeadlines',label: t('sections.widgetLabels.upcomingDeadlines') },
              { key: 'nextEvents',       label: t('sections.widgetLabels.nextEvents') },
              { key: 'projectsOverview', label: t('sections.widgetLabels.projectsOverview') },
            ] as const
            const hiddenItems = allDashboardItems.filter(item => !(dashboardVisibility[item.key] ?? true))
            if (hiddenItems.length === 0) {
              return <p className="text-xs text-gray-400">{t('sections.allWidgetsVisible')}</p>
            }
            return (
              <div className="flex flex-wrap gap-2">
                {hiddenItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleDashboardWidget(item.key)}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-racing-800 dark:bg-racing-900 dark:text-racing-200 dark:hover:bg-racing-800 shadow-sm transition-all duration-150 active:scale-95"
                  >
                    <Plus size={12} className="text-green-500" />
                    {item.label}
                  </button>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Focus Horizon main grid: agenda ~60% + focus ~40% */}
      <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-5">
        <div className="flex flex-col gap-5 lg:col-span-3">
          {(dashboardVisibility.weather ?? true) && (
            <div className={`relative group rounded-2xl transition-all ${isEditing ? 'border-2 border-dashed border-accent/40 bg-accent/5 p-3' : ''}`}>
              {isEditing && (
                <button type="button" onClick={() => toggleDashboardWidget('weather')} className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md" title={t('sections.removeWidget')}>
                  <X size={12} />
                </button>
              )}
              <div className="max-w-xs"><WeatherWidget /></div>
            </div>
          )}
          {dashboardVisibility.dayPlan && (
            <div className={`bento-card relative group p-3 transition-all ${isEditing ? 'ring-2 ring-dashed ring-accent/40' : ''}`}>
              {isEditing && (
                <button type="button" onClick={() => toggleDashboardWidget('dayPlan')} className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md" title={t('sections.removeWidget')}>
                  <X size={12} />
                </button>
              )}
              <DayPlanWidget date={today} />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-5 lg:col-span-2">
          {dashboardVisibility.topPriority && (() => {
            const topPriorityTasks = allTasks.filter((tk) => !tk.completed && tk.urgent && tk.important).slice(0, 6)
            return (
              <div className={`bento-card relative group p-4 transition-all ${isEditing ? 'ring-2 ring-dashed ring-accent/40' : ''}`}>
                {isEditing && (
                  <button type="button" onClick={() => toggleDashboardWidget('topPriority')} className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md" title={t('sections.removeWidget')}>
                    <X size={12} />
                  </button>
                )}
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Flame size={16} className="text-red-500" />
                    {t('sections.topPriority')}
                  </h2>
                </div>
                {topPriorityTasks.length === 0 ? (
                  <div className="flex flex-col items-start gap-1 rounded-2xl bg-emerald-500/5 px-3 py-4">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      <Check size={15} />
                      {t('readiness.delight.noQ1')}
                    </p>
                    <p className="text-xs text-gray-400">{t('readiness.delight.noQ1Hint')}</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {topPriorityTasks.map((tk) => (
                      <div key={tk.id} className="flex w-full items-center gap-3 rounded-2xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (tk.boardId) toggleProjectTaskCompleted(tk.id)
                            else toggleTaskCompleted(tk.id)
                          }}
                          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-300 hover:border-accent dark:border-racing-600"
                        />
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditingTask(tk)}>
                          <p className="truncate text-sm font-medium">{tk.title}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:col-span-5">
          <DayCapacityWidget openTaskCount={todayOpenTasks.length} meetingMinutes={meetingMinutesToday} />
          <WeekOverviewWidget tasks={allTasks} entries={calendarEntries} />
        </div>
      </div>

      {dashboardVisibility.upcomingDeadlines !== false && (weekTasks.length > 0 || weekEntries.length > 0) && (
        <div className={`mb-6 relative group rounded-xl p-3 transition-all ${isEditing ? 'border-2 border-dashed border-accent/40 bg-accent/5' : ''}`}>
          {isEditing && (
            <button
              type="button"
              onClick={() => toggleDashboardWidget('upcomingDeadlines')}
              className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-95 transition-all"
              title={t('sections.removeWidget')}
            >
              <X size={12} />
            </button>
          )}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('sections.dueThisWeek')}</h2>
            <div className="flex items-center gap-3">
              {weekEntries.length > 0 && (
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-400">
                  <span>{t('sections.showAppointmentsToggle')}</span>
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
              if (id === 'workoffice' && (dashboardVisibility.workoffice ?? true)) return (
                <SortableWidget key="workoffice" id="workoffice" isEditing={isEditing} onRemove={() => toggleDashboardWidget('workoffice')}><WorkOfficeWidget /></SortableWidget>
              )
              if (id === 'stats_week' && (dashboardVisibility.stats ?? true)) return (
                <SortableWidget key="stats_week" id="stats_week" isEditing={isEditing} onRemove={() => toggleDashboardWidget('stats')}>
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
                <SortableWidget key="stats_projects" id="stats_projects" isEditing={isEditing} onRemove={() => toggleDashboardWidget('stats')}>
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
          {dashboardVisibility.upcomingDeadlines && (
            <div className={`relative group rounded-xl p-3 transition-all ${isEditing ? 'border-2 border-dashed border-accent/40 bg-accent/5' : ''}`}>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => toggleDashboardWidget('upcomingDeadlines')}
                  className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-95 transition-all"
                  title={t('sections.removeWidget')}
                >
                  <X size={12} />
                </button>
              )}
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
          )}

          {dashboardVisibility.nextEvents && (
            <div className={`relative group rounded-xl p-3 transition-all ${isEditing ? 'border-2 border-dashed border-accent/40 bg-accent/5' : ''}`}>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => toggleDashboardWidget('nextEvents')}
                  className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-95 transition-all"
                  title={t('sections.removeWidget')}
                >
                  <X size={12} />
                </button>
              )}
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
          )}
        </div>
      </div>

      {dashboardVisibility.projectsOverview && (
        <div className={`mt-6 relative group rounded-xl p-3 transition-all ${isEditing ? 'border-2 border-dashed border-accent/40 bg-accent/5' : ''}`}>
          {isEditing && (
            <button
              type="button"
              onClick={() => toggleDashboardWidget('projectsOverview')}
              className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-95 transition-all"
              title={t('sections.removeWidget')}
            >
              <X size={12} />
            </button>
          )}
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
      )}

      {showForm && (
        <TaskFormModal defaultDueDate={todayISO()} onClose={() => setShowForm(false)} />
      )}
      {newTaskForToday && (
        <TaskFormModal defaultDueDate={today} onClose={() => setNewTaskForToday(false)} />
      )}
      {editingTask && (() => {
        const board = editingTask.boardId ? boards.find((b) => b.id === editingTask.boardId) : undefined
        return board ? (
          <ProjectTaskFormModal board={board} task={editingTask} onClose={() => setEditingTask(null)} />
        ) : (
          <TaskFormModal task={editingTask} onClose={() => setEditingTask(null)} />
        )
      })()}
      {showEntryForm && (
        <CalendarEntryFormModal
          entry={editingEntry}
          defaultDate={quickEntryDefaults?.date ?? today}
          defaultEndDate={quickEntryDefaults?.endDate}
          defaultStartTime={quickEntryDefaults?.startTime}
          defaultEndTime={quickEntryDefaults?.endTime}
          defaultTitle={quickEntryDefaults?.title}
          defaultDescription={quickEntryDefaults?.description}
          defaultInvitedUserIds={quickEntryDefaults?.invitedUserIds}
          onClose={() => {
            setShowEntryForm(false)
            setEditingEntry(undefined)
            setQuickEntryDefaults(null)
          }}
        />
      )}
    </div>
  )
}

function SortableWidget({
  id,
  children,
  isEditing,
  onRemove,
}: {
  id: string
  children: React.ReactNode
  isEditing: boolean
  onRemove: () => void
}) {
  const { t } = useTranslation('dashboard')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`relative group flex flex-col rounded-xl transition-all ${
        isEditing ? 'ring-2 ring-dashed ring-accent/40 bg-accent/5 p-1' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className={`absolute left-2 top-2 z-10 cursor-grab rounded p-1 bg-white dark:bg-racing-900 border border-gray-100 dark:border-racing-800 shadow-sm transition-all active:cursor-grabbing touch-none ${
          isEditing ? 'opacity-100 scale-100' : 'opacity-0 group-hover:opacity-60 hover:!opacity-100'
        }`}
        title={t('sections.moveWidget')}
        tabIndex={-1}
      >
        <GripHorizontal size={12} className="text-gray-500" />
      </button>

      {/* Remove button */}
      {isEditing && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -right-1.5 -top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-95 transition-all"
          title={t('sections.removeWidget')}
        >
          <X size={10} />
        </button>
      )}

      {children}
    </div>
  )
}
