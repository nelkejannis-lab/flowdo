import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import Logo from './Logo'
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Trello,
  Clock,
  Sun,
  Moon,
  Sparkles,
  Plus,
  Inbox,
  CheckCircle2,
  Grid2x2,
  Users,
  LogOut,
  Instagram,
  Settings,
  X,
  Folder,
  ChevronDown,
  Bell,
  MessageCircle,
} from 'lucide-react'
import { useMessagesStore } from '../../store/messagesStore'
import { useBoardsStore } from '../../store/boardsStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { useTaskSharesStore } from '../../store/taskSharesStore'
import { useBoardInvitesStore } from '../../store/boardInvitesStore'
import { useTeamInvitesStore } from '../../store/teamInvitesStore'
import { useNotificationsStore } from '../../store/notificationsStore'
import { isSupabaseConfigured } from '../../lib/supabase'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-accent/10 text-accent'
      : 'text-gray-600 hover:bg-gray-100 dark:text-racing-100 dark:hover:bg-racing-800'
  }`

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const boards = useBoardsStore((s) => s.boards)
  const folders = useBoardsStore((s) => s.folders)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const fetchFolders = useBoardsStore((s) => s.fetchFolders)
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const taskIncoming = useTaskSharesStore((s) => s.incoming)
  const fetchTaskIncoming = useTaskSharesStore((s) => s.fetchIncoming)
  const boardIncoming = useBoardInvitesStore((s) => s.incoming)
  const fetchBoardIncoming = useBoardInvitesStore((s) => s.fetchIncoming)
  const teamIncoming = useTeamInvitesStore((s) => s.incoming)
  const fetchTeamIncoming = useTeamInvitesStore((s) => s.fetchIncoming)
  const unreadMessages = useMessagesStore((s) => s.unreadTotal)
  const fetchConversations = useMessagesStore((s) => s.fetchConversations)
  const unreadNotifications = useNotificationsStore((s) => s.unreadCount)
  const fetchNotifications = useNotificationsStore((s) => s.fetch)
  const checkBirthdays = useNotificationsStore((s) => s.checkBirthdays)
  const notificationCount = taskIncoming.length + boardIncoming.length + teamIncoming.length + unreadNotifications
  const mode = useSettingsStore((s) => s.mode)
  const setMode = useSettingsStore((s) => s.setMode)
  const pinkAccent = useSettingsStore((s) => s.pinkAccent)
  const togglePinkAccent = useSettingsStore((s) => s.togglePinkAccent)
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)

  useEffect(() => {
    if (isSupabaseConfigured) {
      fetchBoards()
      fetchFolders()
      fetchTaskIncoming()
      fetchBoardIncoming()
      fetchTeamIncoming()
      fetchConversations()
      checkBirthdays().then(() => fetchNotifications())
    } else {
      fetchBoards()
    }
  }, [fetchBoards, fetchFolders, fetchTaskIncoming, fetchBoardIncoming, fetchTeamIncoming, fetchConversations, fetchNotifications, checkBirthdays])

  function toggleFolder(id: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col overflow-y-auto border-r border-gray-200 bg-white px-3 py-4 transition-transform duration-200 dark:border-racing-800 dark:bg-racing-900 sm:static sm:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div className="mb-6 flex items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-semibold">Mooncrew</span>
        </div>
        <div className="flex items-center gap-1">
          <NavLink
            to="/chat"
            onClick={onClose}
            className="relative rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
            aria-label="Chat"
          >
            <MessageCircle size={18} />
            {unreadMessages > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </NavLink>
          <NavLink
            to="/tasks/inbox"
            onClick={onClose}
            className="relative rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
            aria-label="Inbox"
          >
            <Bell size={18} />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </NavLink>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800 sm:hidden"
            aria-label="Menü schließen"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <nav onClick={onClose} className="flex flex-col gap-1">
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
          <NavLink to="/ki-termine" className={navItemClass}>
            <Sparkles size={18} />
            KI-Termine
          </NavLink>
        )}
        {isSupabaseConfigured && (
          <NavLink to="/chat" className={navItemClass} onClick={onClose}>
            <span className="relative">
              <MessageCircle size={18} />
              {unreadMessages > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </span>
            Chat
          </NavLink>
        )}
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
            onClick={onClose}
            className="text-gray-400 hover:text-accent"
            title="Projekte verwalten"
          >
            <Plus size={16} />
          </NavLink>
        </div>
        <div className="flex flex-col gap-1">
          <NavLink to="/projekte" end className={navItemClass} onClick={onClose}>
            <Trello size={18} />
            Alle Projekte
          </NavLink>

          {/* Folders with their boards */}
          {folders.map((folder) => {
            const folderBoards = boards.filter((b) => b.folderId === folder.id)
            const isOpen = openFolders.has(folder.id)
            return (
              <div key={folder.id}>
                <button
                  onClick={() => toggleFolder(folder.id)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-racing-100 dark:hover:bg-racing-800"
                >
                  <Folder size={18} className="flex-shrink-0" />
                  <span className="flex-1 truncate text-left">{folder.title}</span>
                  <span className="text-xs text-gray-400">{folderBoards.length}</span>
                  <ChevronDown
                    size={14}
                    className={`flex-shrink-0 text-gray-400 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                  />
                </button>
                {isOpen && (
                  <div className="ml-4 flex flex-col gap-1 border-l border-gray-100 pl-2 dark:border-racing-800">
                    {folderBoards.length === 0 ? (
                      <span className="px-3 py-1.5 text-xs text-gray-400">Leer</span>
                    ) : (
                      folderBoards.map((board) => (
                        <NavLink key={board.id} to={`/projekte/${board.id}`} className={navItemClass} onClick={onClose}>
                          <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: board.color }} />
                          <span className="truncate">{board.title}</span>
                        </NavLink>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Boards without folder */}
          {boards.filter((b) => !b.folderId).map((board) => (
            <NavLink key={board.id} to={`/projekte/${board.id}`} className={navItemClass} onClick={onClose}>
              <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: board.color }} />
              <span className="truncate">{board.title}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-1 pt-4">
        {isSupabaseConfigured && profile && (
          <NavLink
            to="/einstellungen"
            onClick={onClose}
            className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100 dark:hover:bg-racing-800"
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profilbild"
                className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: profile.avatar_color }}
              >
                {profile.display_name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile.display_name}</p>
              <p className="truncate text-xs text-gray-400">@{profile.username}</p>
            </div>
            <Settings size={16} className="flex-shrink-0 text-gray-400" />
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                signOut()
              }}
              title="Abmelden"
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-racing-700"
            >
              <LogOut size={16} />
            </button>
          </NavLink>
        )}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-racing-800">
          <button
            onClick={() => setMode('light')}
            title="Light Mode"
            aria-label="Light Mode"
            className={`flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors ${
              mode === 'light'
                ? 'bg-white text-gray-700 shadow-sm dark:bg-racing-700 dark:text-white'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-racing-100'
            }`}
          >
            <Sun size={16} />
          </button>
          <button
            onClick={() => setMode('dark')}
            title="Dark Mode"
            aria-label="Dark Mode"
            className={`flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors ${
              mode === 'dark'
                ? 'bg-white text-gray-700 shadow-sm dark:bg-racing-700 dark:text-white'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-racing-100'
            }`}
          >
            <Moon size={16} />
          </button>
          <button
            onClick={togglePinkAccent}
            title="Pink Mode"
            aria-label="Pink Mode"
            className={`flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors ${
              pinkAccent
                ? 'bg-white text-gray-700 shadow-sm dark:bg-racing-700 dark:text-white'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-racing-100'
            }`}
          >
            <Sparkles size={16} />
          </button>
        </div>
      </div>
      </aside>
    </>
  )
}
