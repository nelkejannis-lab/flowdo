import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import { useSettingsStore } from './store/settingsStore'
import { useAuthStore } from './store/authStore'
import { useTasksStore } from './store/tasksStore'
import { useCalendarEntriesStore } from './store/calendarEntriesStore'
import { useNotifications } from './hooks/useNotifications'
import { useCalendarReminders } from './hooks/useCalendarReminders'
import { isSupabaseConfigured } from './lib/supabase'
import ErrorBoundary from './components/layout/ErrorBoundary'
import TaskFormModal from './components/tasks/TaskFormModal'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useQuickTaskModalStore } from './store/quickTaskModalStore'
import TaskTray from './components/layout/TaskTray'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const TasksPage = lazy(() => import('./pages/Tasks'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const TerminePage = lazy(() => import('./pages/TerminePage'))
const BoardsPage = lazy(() => import('./pages/Boards'))
const BoardDetailPage = lazy(() => import('./pages/BoardDetailPage'))
const ArbeitszeitPage = lazy(() => import('./pages/ArbeitszeitPage'))
const EisenhowerPage = lazy(() => import('./pages/EisenhowerPage'))
const FriendsPage = lazy(() => import('./pages/FriendsPage'))
const SocialMediaPage = lazy(() => import('./pages/SocialMediaPage'))
const SocialAccountDetailPage = lazy(() => import('./pages/SocialAccountDetailPage'))
const AiSchedulerPage = lazy(() => import('./pages/AiSchedulerPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const PomodoroPage = lazy(() => import('./pages/PomodoroPage'))
const SecondBrainPage = lazy(() => import('./pages/SecondBrainPage'))
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'))
const DatenschutzPage = lazy(() => import('./pages/legal/DatenschutzPage'))
const ImpressumPage = lazy(() => import('./pages/legal/ImpressumPage'))
const InstagramCallbackPage = lazy(() => import('./pages/InstagramCallbackPage'))

function PageLoader() {
  const { t } = useTranslation('layout')
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-gray-400">
      {t('loading')}
    </div>
  )
}

export default function App() {
  const { t } = useTranslation('layout')
  const location = useLocation()
  const mode = useSettingsStore((s) => s.mode)
  const pinkAccent = useSettingsStore((s) => s.pinkAccent)
  const init = useAuthStore((s) => s.init)
  const loading = useAuthStore((s) => s.loading)
  const session = useAuthStore((s) => s.session)
  const subscribeToTasks = useTasksStore((s) => s.subscribeToTasks)
  const subscribeToEntries = useCalendarEntriesStore((s) => s.subscribeToEntries)
  useNotifications()
  useCalendarReminders()

  useEffect(() => {
    if (!isSupabaseConfigured || !session) return
    const unsubTasks = subscribeToTasks()
    const unsubEntries = subscribeToEntries()
    return () => {
      unsubTasks()
      unsubEntries()
    }
  }, [session, subscribeToTasks, subscribeToEntries])

  const [showNewTask, setShowNewTask] = useState(false)
  const quickTaskModal = useQuickTaskModalStore()
  useKeyboardShortcuts({ onNewTask: () => setShowNewTask(true) })

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.classList.toggle('pink', pinkAccent)
  }, [mode, pinkAccent])

  useEffect(() => {
    const unsubscribe = init()
    return unsubscribe
  }, [init])

  if (location.pathname === '/datenschutz') {
    return (
      <Suspense fallback={<PageLoader />}>
        <DatenschutzPage />
      </Suspense>
    )
  }
  if (location.pathname === '/impressum') {
    return (
      <Suspense fallback={<PageLoader />}>
        <ImpressumPage />
      </Suspense>
    )
  }

  if (isSupabaseConfigured && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        {t('loading')}
      </div>
    )
  }

  if (isSupabaseConfigured && !session) {
    return <LoginPage />
  }

  return (
    <>
    {showNewTask && <TaskFormModal onClose={() => setShowNewTask(false)} />}
    {quickTaskModal.isOpen && (
      <TaskFormModal
        defaultTitle={quickTaskModal.props?.defaultTitle}
        defaultDueDate={quickTaskModal.props?.defaultDueDate}
        defaultProjectId={quickTaskModal.props?.defaultProjectId}
        defaultPriority={quickTaskModal.props?.defaultPriority}
        defaultUrgent={quickTaskModal.props?.defaultUrgent}
        defaultImportant={quickTaskModal.props?.defaultImportant}
        onClose={() => quickTaskModal.close()}
      />
    )}
    <TaskTray />
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/datenschutz" element={<DatenschutzPage />} />
      <Route path="/impressum" element={<ImpressumPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:smartList" element={<TasksPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/termine" element={<TerminePage />} />
        <Route path="/projekte" element={<BoardsPage />} />
        <Route path="/projekte/:boardId" element={<BoardDetailPage />} />
        <Route path="/arbeitszeit" element={<ArbeitszeitPage />} />
        <Route path="/eisenhower" element={<EisenhowerPage />} />
        <Route path="/friends" element={isSupabaseConfigured ? <FriendsPage /> : <Navigate to="/" replace />} />
        <Route path="/social" element={isSupabaseConfigured ? <SocialMediaPage /> : <Navigate to="/" replace />} />
        <Route path="/social/:accountId" element={isSupabaseConfigured ? <SocialAccountDetailPage /> : <Navigate to="/" replace />} />
        <Route path="/instagram-callback" element={<InstagramCallbackPage />} />
        <Route path="/pomodoro" element={<PomodoroPage />} />
        <Route path="/gehirn" element={<SecondBrainPage />} />
        <Route path="/meetings" element={<MeetingsPage />} />
        <Route path="/ki-termine" element={isSupabaseConfigured ? <AiSchedulerPage /> : <Navigate to="/" replace />} />
        <Route path="/chat" element={isSupabaseConfigured ? <ChatPage /> : <Navigate to="/" replace />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
    </ErrorBoundary>
    </>
  )
}
