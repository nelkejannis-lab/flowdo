import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import TasksPage from './pages/Tasks'
import CalendarPage from './pages/CalendarPage'
import TerminePage from './pages/TerminePage'
import BoardsPage from './pages/Boards'
import BoardDetailPage from './pages/BoardDetailPage'
import ArbeitszeitPage from './pages/ArbeitszeitPage'
import EisenhowerPage from './pages/EisenhowerPage'
import LoginPage from './pages/LoginPage'
import FriendsPage from './pages/FriendsPage'
import SocialMediaPage from './pages/SocialMediaPage'
import SocialAccountDetailPage from './pages/SocialAccountDetailPage'
import AiSchedulerPage from './pages/AiSchedulerPage'
import ChatPage from './pages/ChatPage'
import SettingsPage from './pages/SettingsPage'
import PomodoroPage from './pages/PomodoroPage'
import DatenschutzPage from './pages/legal/DatenschutzPage'
import ImpressumPage from './pages/legal/ImpressumPage'
import InstagramCallbackPage from './pages/InstagramCallbackPage'
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

  if (location.pathname === '/datenschutz') return <DatenschutzPage />
  if (location.pathname === '/impressum') return <ImpressumPage />

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
    <ErrorBoundary>
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
        <Route path="/ki-termine" element={isSupabaseConfigured ? <AiSchedulerPage /> : <Navigate to="/" replace />} />
        <Route path="/chat" element={isSupabaseConfigured ? <ChatPage /> : <Navigate to="/" replace />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ErrorBoundary>
    </>
  )
}
