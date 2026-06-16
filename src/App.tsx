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
import DatenschutzPage from './pages/legal/DatenschutzPage'
import ImpressumPage from './pages/legal/ImpressumPage'
import { useSettingsStore } from './store/settingsStore'
import { useAuthStore } from './store/authStore'
import { useNotifications } from './hooks/useNotifications'
import { isSupabaseConfigured } from './lib/supabase'
import ErrorBoundary from './components/layout/ErrorBoundary'
import TaskFormModal from './components/tasks/TaskFormModal'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

export default function App() {
  const { t } = useTranslation('layout')
  const location = useLocation()
  const mode = useSettingsStore((s) => s.mode)
  const pinkAccent = useSettingsStore((s) => s.pinkAccent)
  const featureVisibility = useSettingsStore((s) => s.featureVisibility)
  const init = useAuthStore((s) => s.init)
  const loading = useAuthStore((s) => s.loading)
  const session = useAuthStore((s) => s.session)
  useNotifications()

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
        <Route path="/calendar" element={featureVisibility.calendar ? <CalendarPage /> : <Navigate to="/" replace />} />
        <Route path="/termine" element={<TerminePage />} />
        <Route path="/projekte" element={<BoardsPage />} />
        <Route path="/projekte/:boardId" element={<BoardDetailPage />} />
        <Route path="/arbeitszeit" element={featureVisibility.worktime ? <ArbeitszeitPage /> : <Navigate to="/" replace />} />
        <Route path="/eisenhower" element={featureVisibility.eisenhower ? <EisenhowerPage /> : <Navigate to="/" replace />} />
        <Route path="/friends" element={featureVisibility.friends ? <FriendsPage /> : <Navigate to="/" replace />} />
        <Route path="/social" element={featureVisibility.social ? <SocialMediaPage /> : <Navigate to="/" replace />} />
        <Route path="/social/:accountId" element={featureVisibility.social ? <SocialAccountDetailPage /> : <Navigate to="/" replace />} />
        <Route path="/ki-termine" element={featureVisibility.aiScheduler ? <AiSchedulerPage /> : <Navigate to="/" replace />} />
        <Route path="/chat" element={featureVisibility.chat ? <ChatPage /> : <Navigate to="/" replace />} />
        <Route path="/einstellungen" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ErrorBoundary>
    </>
  )
}
