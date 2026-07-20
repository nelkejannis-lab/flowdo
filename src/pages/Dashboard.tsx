import React, { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO, addDays, startOfWeek, isSameDay, isMonday } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { Plus, CalendarClock, Loader2, Check, X, Sparkles, Flame, BarChart3 } from 'lucide-react'
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
import OnboardingPermissions from '../components/dashboard/OnboardingPermissions'
import OnboardingWizard from '../components/onboarding/OnboardingWizard'
import MorningReportModal from '../components/dashboard/MorningReportModal'
import PriorityPlanModal from '../components/dashboard/PriorityPlanModal'
import EveningReportModal from '../components/dashboard/EveningReportModal'
import JournalModal from '../components/dashboard/JournalModal'
import DayTimeTimeline from '../components/worktime/DayTimeTimeline'
import Modal from '../components/layout/Modal'
import TodayHero from '../components/dashboard/TodayHero'
import WeeklyInsightCard from '../components/dashboard/WeeklyInsightCard'
import { DayCapacityWidget, WeekOverviewWidget } from '../components/dashboard/FocusWidgets'
import DashboardCustomizePanel from '../components/dashboard/DashboardCustomizePanel'
import TeamWeekWorkload from '../components/boards/TeamWeekWorkload'
import DashboardSectionHeader from '../components/dashboard/DashboardSectionHeader'
import TaskTimer from '../components/tasks/TaskTimer'
import { useSettingsStore } from '../store/settingsStore'
import { usePriorityPlanStore, weekKey } from '../store/priorityPlanStore'
import { useTaskTimeStore } from '../store/taskTimeStore'
import {
  buildDashboardLayoutBlocks,
  normalizeDashboardSectionOrder,
  type DashboardSectionId,
} from '../lib/dashboardLayout'
import { isDueThisWeek, isDueToday, isOverdue, todayISO, parseTaskInput, parseAppointmentInput, isCompletedToday } from '../utils/date'
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
  const isOnBreak = useWorkTimeStore((s) => s.isOnBreak)
  const breakStartedAt = useWorkTimeStore((s) => s.breakStartedAt)
  const colleagueEntries = useOfficeStore((s) => s.colleagueEntries)
  const todayOffice = useOfficeStore((s) => s.todayEntry)
  const fetchOfficeToday = useOfficeStore((s) => s.fetchToday)
  const events = useEventsStore((s) => s.events)
  const calendarEntries = useCalendarEntriesStore((s) => s.entries)
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
  const [quickInput, setQuickInput] = useState('')
  const [quickMode, setQuickMode] = useState<'auto' | 'task' | 'appointment'>('auto')
  const [parsingTask, setParsingTask] = useState(false)
  const quickInputRef = useRef<HTMLInputElement>(null)
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
  const [showWeekEntries, setShowWeekEntries] = useState(true)
  const [showMorningReport, setShowMorningReport] = useState(false)
  const [showDayPriority, setShowDayPriority] = useState(false)
  const [showWeekPriority, setShowWeekPriority] = useState(false)
  const [showEveningReport, setShowEveningReport] = useState(false)
  const [showJournal, setShowJournal] = useState(false)
  const [showTimeTimeline, setShowTimeTimeline] = useState(false)
  const dayOrders = usePriorityPlanStore((s) => s.dayOrders)
  const weekOrders = usePriorityPlanStore((s) => s.weekOrders)
  const dayConfirmed = usePriorityPlanStore((s) => s.dayConfirmed)
  const weekConfirmed = usePriorityPlanStore((s) => s.weekConfirmed)
  const setDayOrder = usePriorityPlanStore((s) => s.setDayOrder)
  const setWeekOrder = usePriorityPlanStore((s) => s.setWeekOrder)
  const confirmDay = usePriorityPlanStore((s) => s.confirmDay)
  const confirmWeek = usePriorityPlanStore((s) => s.confirmWeek)
  const setTomorrowTop3 = usePriorityPlanStore((s) => s.setTomorrowTop3)
  const applyOrder = usePriorityPlanStore((s) => s.applyOrder)
  const tomorrowTop3 = usePriorityPlanStore((s) => s.tomorrowTop3)
  const taskTimeEntries = useTaskTimeStore((s) => s.entries)
  const fetchTaskTime = useTaskTimeStore((s) => s.fetchForUser)
  const wasRunningRef = useRef(false)
  const sectionOrder = useSettingsStore((s) => normalizeDashboardSectionOrder(s.dashboardSectionOrder))
  const ritualWeekPriority = useSettingsStore((s) => s.ritualWeekPriority)
  const ritualDayPriority = useSettingsStore((s) => s.ritualDayPriority)
  const ritualMorningBriefing = useSettingsStore((s) => s.ritualMorningBriefing)
  const ritualEveningWrapUp = useSettingsStore((s) => s.ritualEveningWrapUp)
  const ritualMorgenTop3 = useSettingsStore((s) => s.ritualMorgenTop3)
  const ritualJournal = useSettingsStore((s) => s.ritualJournal)

  // Daily ritual: week prio (Mon) → day prio → morning briefing → evening wrap-up
  useEffect(() => {
    const hour = new Date().getHours()
    const today = todayISO()
    const wk = weekKey()
    const morningDismissed = localStorage.getItem('morningReportDismissed')
    const eveningDismissed = localStorage.getItem('eveningReportDismissed')
    const journalDismissed = localStorage.getItem('journalDismissed')
    const openToday = [...tasks, ...myProjectTasks].filter(
      (tk) => !tk.completed && (isDueToday(tk.dueDate) || isOverdue(tk.dueDate)),
    )
    const openWeek = [...tasks, ...myProjectTasks].filter(
      (tk) => !tk.completed && isDueThisWeek(tk.dueDate) && !isOverdue(tk.dueDate),
    )

    if (
      ritualWeekPriority &&
      isMonday(new Date()) &&
      !weekConfirmed[wk] &&
      localStorage.getItem('weekPrioritySkipped') !== wk &&
      openWeek.length > 0
    ) {
      setShowWeekPriority(true)
      return
    }
    if (
      ritualDayPriority &&
      hour >= 5 &&
      hour < 14 &&
      !dayConfirmed[today] &&
      localStorage.getItem('dayPrioritySkipped') !== today &&
      openToday.length > 0
    ) {
      setShowDayPriority(true)
      return
    }
    if (ritualMorningBriefing && hour >= 5 && hour < 12 && morningDismissed !== today) {
      setShowMorningReport(true)
      return
    }
    if (ritualEveningWrapUp && hour >= 17 && hour < 19 && eveningDismissed !== today) {
      setShowEveningReport(true)
      return
    }
    if (hour >= 19) {
      if (ritualEveningWrapUp && eveningDismissed !== today) {
        setShowEveningReport(true)
        return
      }
      if (ritualJournal && journalDismissed !== today) {
        setShowJournal(true)
      }
    }
  }, [
    dayConfirmed,
    weekConfirmed,
    tasks,
    myProjectTasks,
    ritualWeekPriority,
    ritualDayPriority,
    ritualMorningBriefing,
    ritualEveningWrapUp,
    ritualJournal,
  ])

  useEffect(() => {
    if (isSupabaseConfigured) void fetchTaskTime()
  }, [fetchTaskTime])

  // Open evening wrap-up after clock-out
  useEffect(() => {
    if (wasRunningRef.current && !isRunning) {
      const today = todayISO()
      if (
        ritualEveningWrapUp &&
        localStorage.getItem('eveningReportDismissed') !== today
      ) {
        setShowEveningReport(true)
      }
    }
    wasRunningRef.current = isRunning
  }, [isRunning, ritualEveningWrapUp])

  const [, workTimeTick] = useState(0)
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => workTimeTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  function isSectionVisible(id: DashboardSectionId): boolean {
    return dashboardVisibility[id] ?? true
  }

  const layoutBlocks = useMemo(
    () => buildDashboardLayoutBlocks(sectionOrder, isSectionVisible),
    [sectionOrder, dashboardVisibility],
  )

  useEffect(() => {
    void fetchOfficeToday()
    void fetchWorkTime()
    if (!isSupabaseConfigured) return
    void fetchTasks()
    void fetchMyProjectTasks()
  }, [fetchOfficeToday, fetchWorkTime, fetchTasks, fetchMyProjectTasks])

  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (cancelled) return
      if (useBoardsStore.getState().boards.length === 0) void fetchBoards()
    }
    const idleId = typeof requestIdleCallback !== 'undefined' ? requestIdleCallback(run, { timeout: 1800 }) : window.setTimeout(run, 450)
    return () => {
      cancelled = true
      if (typeof cancelIdleCallback !== 'undefined') { try { cancelIdleCallback(idleId as number) } catch { clearTimeout(idleId as number) } } else clearTimeout(idleId as number)
    }
  }, [fetchBoards])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let unsub: (() => void) | undefined
    const t = window.setTimeout(() => { unsub = subscribeToMyProjectTasks() }, 700)
    return () => { clearTimeout(t); unsub?.() }
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
  const liveAnchor = isOnBreak && breakStartedAt ? new Date(breakStartedAt).getTime() : Date.now()
  const liveMin = isRunning && runningStartedAt ? (liveAnchor - new Date(runningStartedAt).getTime()) / 60000 : 0
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

  const todayTodos = applyOrder(sortByEisenhower(todayOpenTasks), dayOrders[today] ?? tomorrowTop3[today])
  const weekTasksOrdered = applyOrder(weekTasks, weekOrders[weekKey()])

  const tasksCompletedToday = allTasks.filter((tk) => tk.completed && isCompletedToday(tk.completedAt)).length
  const tasksDoneTodayList = allTasks.filter((tk) => tk.completed && isCompletedToday(tk.completedAt))
  const tasksTotalToday = tasksCompletedToday + todayOpenTasks.length
  const taskMinutesToday = taskTimeEntries.filter((e) => e.date === today).reduce((s, e) => s + e.minutes, 0)
  const suggestedTomorrow = sortByEisenhower(
    allTasks.filter((tk) => !tk.completed && (isDueThisWeek(tk.dueDate) || isOverdue(tk.dueDate) || !tk.dueDate)),
  ).slice(0, 5)
  const meetingsHeldToday = calendarEntries.filter((e) => {
    const isToday = e.date === today
    const isMultiDaySpanningToday = e.date < today && e.endDate && e.endDate >= today
    if (!isToday && !isMultiDaySpanningToday) return false
    if (!isToday) return false
    const endT = e.endTime ?? e.startTime
    return !!endT && endT < nowTime
  }).length
  const meetingsTodayCount = calendarEntries.filter((e) => {
    const isToday = e.date === today
    const isMultiDaySpanningToday = e.date < today && e.endDate && e.endDate >= today
    return isToday || !!isMultiDaySpanningToday
  }).length
  const remainingMeetingMinutes = meetingMinutesToday
  const doneStats = {
    tasksCompleted: tasksCompletedToday,
    tasksTotal: tasksTotalToday,
    meetingsToday: meetingsTodayCount,
    meetingsDone: meetingsHeldToday,
    trackedLabel: formatHM(workedMin),
    targetLabel: formatHM(targetMin),
  }

  return (
    <div>
      <OfficePromptModal />
      {showWeekPriority && (
        <PriorityPlanModal
          key={`week-priority-${weekKey()}`}
          mode="week"
          tasks={weekTasksOrdered.length ? weekTasksOrdered : weekTasks}
          initialOrder={weekOrders[weekKey()]}
          onSave={(ids) => {
            const wk = weekKey()
            setWeekOrder(wk, ids)
            confirmWeek(wk)
            setShowWeekPriority(false)
            const today = todayISO()
            if (ritualDayPriority && !dayConfirmed[today] && todayOpenTasks.length > 0) setShowDayPriority(true)
            else if (ritualMorningBriefing && localStorage.getItem('morningReportDismissed') !== today) setShowMorningReport(true)
          }}
          onSkip={() => {
            localStorage.setItem('weekPrioritySkipped', weekKey())
            setShowWeekPriority(false)
            const today = todayISO()
            if (ritualDayPriority && !dayConfirmed[today] && todayOpenTasks.length > 0) setShowDayPriority(true)
            else if (ritualMorningBriefing && localStorage.getItem('morningReportDismissed') !== today) setShowMorningReport(true)
          }}
          onClose={() => {
            localStorage.setItem('weekPrioritySkipped', weekKey())
            setShowWeekPriority(false)
          }}
        />
      )}
      {showDayPriority && (
        <PriorityPlanModal
          key={`day-priority-${today}`}
          mode="day"
          tasks={todayOpenTasks}
          initialOrder={dayOrders[today] ?? tomorrowTop3[today]}
          onSave={(ids) => {
            setDayOrder(today, ids)
            confirmDay(today)
            setShowDayPriority(false)
            if (ritualMorningBriefing && localStorage.getItem('morningReportDismissed') !== today) setShowMorningReport(true)
          }}
          onSkip={() => {
            localStorage.setItem('dayPrioritySkipped', today)
            setShowDayPriority(false)
            if (ritualMorningBriefing && localStorage.getItem('morningReportDismissed') !== today) setShowMorningReport(true)
          }}
          onClose={() => {
            localStorage.setItem('dayPrioritySkipped', today)
            setShowDayPriority(false)
          }}
        />
      )}
      {showMorningReport && !showDayPriority && !showWeekPriority && (
        <MorningReportModal
          todayTasks={todayTodos}
          weekTasks={weekTasksOrdered}
          todayEntries={todayEntries}
          weekEntries={weekEntries}
          capacityPercent={capacityPercent}
          workedLabel={formatHM(workedMin)}
          targetLabel={formatHM(targetMin)}
          colleagues={colleagues}
          onPlanDay={() => setShowAiDayPlanner(true)}
          onPrioritize={() => {
            if (ritualWeekPriority && isMonday(new Date()) && !weekConfirmed[weekKey()]) setShowWeekPriority(true)
            else if (ritualDayPriority) setShowDayPriority(true)
          }}
          onClose={() => {
            setShowMorningReport(false)
            localStorage.setItem('morningReportDismissed', today)
          }}
        />
      )}
      {showEveningReport && !showDayPriority && !showWeekPriority && !showMorningReport && (
        <EveningReportModal
          doneTasks={tasksDoneTodayList}
          openTasks={todayOpenTasks}
          workedLabel={formatHM(workedMin)}
          taskMinutesLabel={taskMinutesToday > 0 ? formatHM(taskMinutesToday) : undefined}
          suggestedTop3={suggestedTomorrow}
          showMorgenTop3={ritualMorgenTop3}
          onConfirmTop3={(ids) => {
            const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
            setTomorrowTop3(tomorrow, ids)
            localStorage.setItem('eveningReportDismissed', today)
          }}
          onOpenTimeline={() => setShowTimeTimeline(true)}
          onOpenJournal={ritualJournal ? () => setShowJournal(true) : undefined}
          onClose={() => {
            setShowEveningReport(false)
            localStorage.setItem('eveningReportDismissed', today)
            if (
              ritualJournal &&
              new Date().getHours() >= 19 &&
              localStorage.getItem('journalDismissed') !== today
            ) {
              setShowJournal(true)
            }
          }}
        />
      )}
      {showJournal && !showEveningReport && !showDayPriority && !showWeekPriority && !showMorningReport && (
        <JournalModal
          onClose={() => {
            setShowJournal(false)
            localStorage.setItem('journalDismissed', today)
          }}
          onSaved={() => localStorage.setItem('journalDismissed', today)}
        />
      )}
      {showTimeTimeline && (
        <Modal title="Zeit heute" onClose={() => setShowTimeTimeline(false)} widthClass="max-w-lg">
          <DayTimeTimeline initialDate={today} compact />
        </Modal>
      )}
      {!onboardingTourDone && <OnboardingWizard />}
      {!onboardingPermissionsDone && <OnboardingPermissions />}

      {/* Sticky Quick Add — always pinned to top of main scrollport for fast add */}
      <div className="sticky top-0 z-30 mb-6 bg-[rgb(var(--surface-0)/0.82)] py-3 backdrop-blur-apple dark:bg-[rgb(var(--surface-0)/0.88)]">
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            const input = quickInput.trim()
            if (!input || parsingTask) return
            setParsingTask(true)
            try {
              const asAppointment = quickMode === 'appointment' || (quickMode === 'auto' && isLikelyAppointment(input))
              if (asAppointment) {
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
          className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white/90 p-1.5 shadow-apple-sm ring-1 ring-black/[0.02] transition-[box-shadow,border-color] duration-200 ease-apple focus-within:border-accent/25 focus-within:shadow-[0_8px_28px_rgb(var(--accent)/0.12),0_2px_8px_rgba(15,23,42,0.06)] dark:border-white/[0.08] dark:bg-racing-900/90 dark:ring-white/[0.04] dark:focus-within:border-accent/35 sm:p-2"
        >
          <div className="flex items-center gap-1 px-1 pt-0.5">
            {([
              ['auto', t('quickModeAuto')],
              ['task', t('quickModeTask')],
              ['appointment', t('quickModeAppointment')],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setQuickMode(mode); quickInputRef.current?.focus() }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  quickMode === mode
                    ? 'bg-accent/15 text-accent'
                    : 'text-gray-400 hover:bg-black/[0.04] hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-racing-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:gap-2.5">
          <input
            ref={quickInputRef}
            id="dashboard-quick-add"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            disabled={parsingTask}
            placeholder={
              parsingTask
                ? 'Analysiere mit KI...'
                : quickMode === 'task'
                  ? t('quickAddPlaceholderTask')
                  : quickMode === 'appointment'
                    ? t('quickAddPlaceholderAppointment')
                    : t('quickAddPlaceholder')
            }
            className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3.5 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:ring-0 disabled:opacity-75 dark:text-racing-50 dark:placeholder:text-racing-400 sm:px-4"
          />
          <button
            type="submit"
            disabled={!quickInput.trim() || parsingTask}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgb(var(--accent)/0.32)] transition-all duration-200 ease-apple hover:bg-accent-dark hover:shadow-[0_6px_18px_rgb(var(--accent)/0.4)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35 sm:px-4"
          >
            {parsingTask ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} strokeWidth={2.25} />}
            <span className="hidden sm:inline">{parsingTask ? "Analysiere..." : t('addTask')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowWeekReport(true)}
            title={t('weekReport.title')}
            className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-black/[0.02] text-gray-600 transition-all duration-200 ease-apple hover:border-accent/25 hover:bg-accent/[0.06] hover:text-accent active:scale-[0.98] dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-racing-200 dark:hover:border-accent/30 dark:hover:bg-accent/10 dark:hover:text-accent-light"
          >
            <BarChart3 size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => setShowAiDayPlanner(true)}
            title={t('aiPlanner.title')}
            className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white shadow-[0_4px_12px_rgb(var(--accent)/0.28)] transition-all duration-200 ease-apple hover:brightness-[1.06] hover:shadow-[0_6px_16px_rgb(var(--accent)/0.38)] active:scale-[0.98]"
          >
            <Sparkles size={16} strokeWidth={1.75} />
          </button>
          </div>
        </form>
      </div>

      <DashboardCustomizePanel open={isEditing} onOpenChange={setIsEditing} />

      {showAiDayPlanner && <AiDayPlannerModal onClose={() => setShowAiDayPlanner(false)} />}
      {showWeekReport && <WeeklyReportModal onClose={() => setShowWeekReport(false)} />}

      <div className="flex flex-col gap-6">
        {layoutBlocks.map((block) => {
          if (block.type === 'capacityPair') {
            return (
              <div key={block.ids.join('-')} className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {block.ids.map((id) => (
                  <EditableSection key={id} isEditing={isEditing} onRemove={() => toggleDashboardWidget(id)}>
                    {id === 'dayCapacity' ? (
                      <DayCapacityWidget openTaskCount={todayOpenTasks.length} meetingMinutes={remainingMeetingMinutes} />
                    ) : (
                      <WeekOverviewWidget tasks={allTasks} entries={calendarEntries} />
                    )}
                  </EditableSection>
                ))}
              </div>
            )
          }

          if (block.type === 'focusCluster') {
            const left = block.ids.filter((id) => id === 'weather' || id === 'dayPlan')
            const right = block.ids.filter((id) => id === 'topPriority')
            return (
              <div key={block.ids.join('-')} className="grid grid-cols-1 gap-5 lg:grid-cols-5">
                {left.length > 0 && (
                  <div className="flex flex-col gap-5 lg:col-span-3">
                    {left.map((id) => (
                      <EditableSection key={id} isEditing={isEditing} onRemove={() => toggleDashboardWidget(id)}>
                        {id === 'weather' ? (
                          <div className="max-w-xs"><WeatherWidget /></div>
                        ) : (
                          <div className="bento-card p-3"><DayPlanWidget date={today} /></div>
                        )}
                      </EditableSection>
                    ))}
                  </div>
                )}
                {right.length > 0 && (
                  <div className="flex flex-col gap-5 lg:col-span-2">
                    {right.map((id) => (
                      <EditableSection key={id} isEditing={isEditing} onRemove={() => toggleDashboardWidget(id)}>
                        <TopPriorityCard
                          tasks={allTasks}
                          onToggle={(tk) => {
                            if (tk.boardId) toggleProjectTaskCompleted(tk.id)
                            else toggleTaskCompleted(tk.id)
                          }}
                          onOpen={(tk) => setEditingTask(tk)}
                        />
                      </EditableSection>
                    ))}
                  </div>
                )}
              </div>
            )
          }

          const id = block.id
          return (
            <EditableSection key={id} isEditing={isEditing} onRemove={() => toggleDashboardWidget(id)}>
              {id === 'todayHero' && (
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
                  onPrioritizeDay={() => setShowDayPriority(true)}
                  onOpenEvening={() => setShowEveningReport(true)}
                  onOpenTimeline={() => setShowTimeTimeline(true)}
                  onOpenJournal={() => setShowJournal(true)}
                  onToggleTodo={(tk) => {
                    if (tk.boardId) toggleProjectTaskCompleted(tk.id)
                    else toggleTaskCompleted(tk.id)
                  }}
                  onOpenTodo={(tk) => setEditingTask(tk as typeof allTasks[number])}
                />
              )}
              {id === 'timeToday' && (
                <div className="bento-card p-4 sm:p-5">
                  <DayTimeTimeline initialDate={today} compact />
                </div>
              )}
              {id === 'teamWeek' && <TeamWeekWorkload showLink />}
              {id === 'weekFocus' && (
                <WeeklyInsightCard insight={weeklyInsight} onAiRefresh={() => setShowWeekReport(true)} />
              )}
              {id === 'weather' && <div className="max-w-xs"><WeatherWidget /></div>}
              {id === 'dayPlan' && <div className="bento-card p-3"><DayPlanWidget date={today} /></div>}
              {id === 'topPriority' && (
                <TopPriorityCard
                  tasks={allTasks}
                  onToggle={(tk) => {
                    if (tk.boardId) toggleProjectTaskCompleted(tk.id)
                    else toggleTaskCompleted(tk.id)
                  }}
                  onOpen={(tk) => setEditingTask(tk)}
                />
              )}
              {id === 'dayCapacity' && (
                <DayCapacityWidget openTaskCount={todayOpenTasks.length} meetingMinutes={remainingMeetingMinutes} />
              )}
              {id === 'weekOverview' && (
                <WeekOverviewWidget tasks={allTasks} entries={calendarEntries} />
              )}
              {id === 'dueThisWeek' && (weekTasksOrdered.length > 0 || weekEntries.length > 0) && (
                <div>
                  <DashboardSectionHeader
                    title={t('sections.dueThisWeek')}
                    action={
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
                    }
                  />
                  {showWeekEntries && <CalendarEntriesBlock entries={weekEntries} label="Termine diese Woche" today={today} />}
                  <TaskList tasks={weekTasks} groupByDate emptyMessage={t('noTasksThisWeek')} />
                </div>
              )}
              {id === 'workoffice' && <WorkOfficeWidget />}
              {id === 'stats' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Link to="/tasks/week" className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 hover:border-accent/30 hover:shadow-sm transition-all dark:border-racing-800 dark:bg-racing-900">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('stats.dueThisWeek')}</span>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold tabular-nums leading-none">{weekTasks.length}</span>
                      <span className="mb-1 text-sm text-gray-400">Aufgaben</span>
                    </div>
                  </Link>
                  <Link to="/projekte" className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 hover:border-accent/30 hover:shadow-sm transition-all dark:border-racing-800 dark:bg-racing-900">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{t('stats.activeProjects')}</span>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold tabular-nums leading-none">{boards.length}</span>
                      <span className="mb-1 text-sm text-gray-400">Projekte</span>
                    </div>
                  </Link>
                </div>
              )}
              {id === 'upcomingDeadlines' && (
                <div>
                  <DashboardSectionHeader
                    title={t('sections.upcomingDeadlines')}
                    action={
                      <Link to="/projekte" className="text-sm font-medium text-accent hover:underline">{t('allProjects')}</Link>
                    }
                  />
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
              {id === 'nextEvents' && (
                <div>
                  <DashboardSectionHeader
                    title={t('sections.upcomingEvents')}
                    action={
                      <Link to="/calendar" className="text-sm font-medium text-accent hover:underline">{t('calendar')}</Link>
                    }
                  />
                  {upcomingEvents.length === 0 ? (
                    <p className="text-sm text-gray-400">{t('noUpcomingEvents')}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {upcomingEvents.map((event) => {
                        const days = differenceInCalendarDays(parseISO(event.date), parseISO(today))
                        return (
                          <div key={event.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: event.color }}>
                              <CalendarClock size={16} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{event.title}</p>
                              <p className="text-xs text-gray-400">
                                {format(parseISO(event.date), 'd. MMM yyyy', { locale: dateLocale })}
                                {event.endDate && event.endDate > event.date ? ` – ${format(parseISO(event.endDate), 'd. MMM yyyy', { locale: dateLocale })}` : ''}
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
              {id === 'projectsOverview' && (
                <div>
                  <DashboardSectionHeader
                    title={t('sections.projectsOverview')}
                    action={
                      <Link to="/projekte" className="text-sm font-medium text-accent hover:underline">{t('allProjects')}</Link>
                    }
                  />
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
            </EditableSection>
          )
        })}
      </div>

      {showForm && (
        <TaskFormModal defaultDueDate={todayISO()} onClose={() => setShowForm(false)} />
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

function EditableSection({
  children,
  isEditing,
  onRemove,
}: {
  children: React.ReactNode
  isEditing: boolean
  onRemove: () => void
}) {
  const { t } = useTranslation('dashboard')
  if (!children) return null
  return (
    <div className={`relative group transition-all ${isEditing ? 'rounded-2xl border-2 border-dashed border-accent/40 bg-accent/[0.03] p-2 sm:p-3' : ''}`}>
      {isEditing && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 active:scale-95 transition-all"
          title={t('sections.removeWidget')}
        >
          <X size={12} />
        </button>
      )}
      {children}
    </div>
  )
}

function TopPriorityCard({
  tasks,
  onToggle,
  onOpen,
}: {
  tasks: Task[]
  onToggle: (tk: Task) => void
  onOpen: (tk: Task) => void
}) {
  const { t } = useTranslation('dashboard')
  const topPriorityTasks = tasks.filter((tk) => !tk.completed && tk.urgent && tk.important).slice(0, 6)
  return (
    <div className="bento-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-4 w-1 rounded-full bg-red-500/80" aria-hidden />
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
                  onToggle(tk)
                }}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-300 hover:border-accent dark:border-racing-600"
              />
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpen(tk)}>
                <p className="truncate text-sm font-medium">{tk.title}</p>
              </div>
              <TaskTimer taskId={tk.id} boardId={tk.boardId} title={tk.title} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
