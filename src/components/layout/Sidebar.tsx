import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Trello,
  Clock,
  Sun,
  Moon,
  Plus,
  Inbox,
  CheckCircle2,
  Grid2x2,
  Users,
  LogOut,
  Instagram,
} from 'lucide-react'
import { useBoardsStore } from '../../store/boardsStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { isSupabaseConfigured } from '../../lib/supabase'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-accent/10 text-accent'
      : 'text-gray-600 hover:bg-gray-100 dark:text-racing-100 dark:hover:bg-racing-800'
  }`

export default function Sidebar() {
  const boards = useBoardsStore((s) => s.boards)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const theme = useSettingsStore((s) => s.theme)
  const toggleTheme = useSettingsStore((s) => s.toggleTheme)
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)

  useEffect(() => {
    if (isSupabaseConfigured) fetchBoards()
  }, [fetchBoards])

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white px-3 py-4 dark:border-racing-800 dark:bg-racing-900">
      <div className="mb-6 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white font-bold">
          F
        </div>
        <span className="text-lg font-semibold">Flowdo</span>
      </div>

      <nav className="flex flex-col gap-1">
        <NavLink to="/" end className={navItemClass}>
          <LayoutDashboard size={18} />
          Dashboard
        </NavLink>
        <NavLink to="/tasks/week" className={navItemClass}>
          <CheckCircle2 size={18} />
          Diese Woche
        </NavLink>
        <NavLink to="/tasks/inbox" className={navItemClass}>
          <Inbox size={18} />
          Inbox
        </NavLink>
        <NavLink to="/tasks" end className={navItemClass}>
          <ListTodo size={18} />
          Alle Aufgaben
        </NavLink>
        <NavLink to="/calendar" className={navItemClass}>
          <CalendarDays size={18} />
          Kalender
        </NavLink>
        <NavLink to="/eisenhower" className={navItemClass}>
          <Grid2x2 size={18} />
          Eisenhower
        </NavLink>
        <NavLink to="/arbeitszeit" className={navItemClass}>
          <Clock size={18} />
          Arbeitszeit
        </NavLink>
        {isSupabaseConfigured && (
          <NavLink to="/friends" className={navItemClass}>
            <Users size={18} />
            Kollegen
          </NavLink>
        )}
        {isSupabaseConfigured && (
          <NavLink to="/social" className={navItemClass}>
            <Instagram size={18} />
            Social Media
          </NavLink>
        )}
      </nav>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Projekte
          </span>
          <NavLink
            to="/projekte"
            className="text-gray-400 hover:text-accent"
            title="Projekte verwalten"
          >
            <Plus size={16} />
          </NavLink>
        </div>
        <div className="flex flex-col gap-1">
          <NavLink to="/projekte" end className={navItemClass}>
            <Trello size={18} />
            Alle Projekte
          </NavLink>
          {boards.map((board) => (
            <NavLink key={board.id} to={`/projekte/${board.id}`} className={navItemClass}>
              <span
                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                style={{ backgroundColor: board.color }}
              />
              <span className="truncate">{board.title}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-1 pt-4">
        {isSupabaseConfigured && profile && (
          <div className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2">
            <span
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: profile.avatar_color }}
            >
              {profile.display_name.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile.display_name}</p>
              <p className="truncate text-xs text-gray-400">@{profile.username}</p>
            </div>
            <button
              onClick={signOut}
              title="Abmelden"
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-racing-100 dark:hover:bg-racing-800"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        </button>
      </div>
    </aside>
  )
}
