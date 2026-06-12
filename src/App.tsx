import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import TasksPage from './pages/Tasks'
import CalendarPage from './pages/CalendarPage'
import BoardsPage from './pages/Boards'
import BoardDetailPage from './pages/BoardDetailPage'
import ArbeitszeitPage from './pages/ArbeitszeitPage'
import EisenhowerPage from './pages/EisenhowerPage'
import LoginPage from './pages/LoginPage'
import FriendsPage from './pages/FriendsPage'
import SocialMediaPage from './pages/SocialMediaPage'
import SocialAccountDetailPage from './pages/SocialAccountDetailPage'
import AiSchedulerPage from './pages/AiSchedulerPage'
import { useSettingsStore } from './store/settingsStore'
import { useAuthStore } from './store/authStore'
import { isSupabaseConfigured } from './lib/supabase'

export default function App() {
  const mode = useSettingsStore((s) => s.mode)
  const pinkAccent = useSettingsStore((s) => s.pinkAccent)
  const init = useAuthStore((s) => s.init)
  const loading = useAuthStore((s) => s.loading)
  const session = useAuthStore((s) => s.session)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', mode === 'dark')
    root.classList.toggle('pink', pinkAccent)
  }, [mode, pinkAccent])

  useEffect(() => {
    const unsubscribe = init()
    return unsubscribe
  }, [init])

  if (isSupabaseConfigured && loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        Lädt…
      </div>
    )
  }

  if (isSupabaseConfigured && !session) {
    return <LoginPage />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:smartList" element={<TasksPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/projekte" element={<BoardsPage />} />
        <Route path="/projekte/:boardId" element={<BoardDetailPage />} />
        <Route path="/arbeitszeit" element={<ArbeitszeitPage />} />
        <Route path="/eisenhower" element={<EisenhowerPage />} />
        <Route path="/friends" element={<FriendsPage />} />
        <Route path="/social" element={<SocialMediaPage />} />
        <Route path="/social/:accountId" element={<SocialAccountDetailPage />} />
        <Route path="/ki-termine" element={<AiSchedulerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
