import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo'
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  CalendarClock,
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
  Search,
} from 'lucide-react'
import { useSearchStore } from '../../store/searchStore'
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
  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-accent/10 text-accent shadow-sm'
      : 'text-gray-600 hover:bg-black/[0.04] dark:text-racing-100 dark:hover:bg-white/[0.06]'
  }`

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation('layout')
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
  const featureVisibility = useSettingsStore((s) => s.featureVisibility)
  const profile = useAuthStore((s) => s.profile)
  const signOut = useAuthStore((s) => s.signOut)
  const openSearch = useSearchStore((s) => s.open)

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
        style={{ paddingTop: 'max(16px, calc(16px + env(safe-area-inset-top)))', paddingBottom: 'max(16px, calc(16px + env(safe-area-inset-bottom)))', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' }}
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col overflow-y-auto border-r border-gray-100/80 bg-white/90 px-3 transition-transform duration-300 dark:border-white/5 dark:bg-racing-900/90 sm:static sm:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div className="mb-6 flex items-center justify-between gap-1 px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Logo />
          <span className="truncate text-base font-semibold sm:text-lg">{t('appName')}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-0">
          <button
            onClick={openSearch}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
            aria-label={t('sidebar.search')}
            title={t('sidebar.searchTitle')}
          >
            <Search size={16} />
          </button>
          {featureVisibility.chat && (
            <NavLink
              to="/chat"
              onClick={onClose}
              className="relative rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
              aria-label={t('sidebar.chat')}
            >
              <MessageCircle size={16} />
              {unreadMessages > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </NavLink>
          )}
          <NavLink
            to="/tasks/inbox"
            onClick={onClose}
            className="relative rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
            aria-label={t('sidebar.inbox')}
          >
            <Bell size={16} />
            {notificationCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {notificationCount > 9 ? '9+' : notificationCount}
              </span>
            )}
          </NavLink>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800 sm:hidden"
            aria-label={t('sidebar.closeMenu')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <nav onClick={onClose} className="flex flex-col gap-1">
        <NavLink to="/" end className={navItemClass}>
          <LayoutDashboard size={18} />
          {t('sidebar.nav.dashboard')}
        </NavLink>
        <NavLink to="/tasks/week" className={navItemClass}>
          <CheckCircle2 size={18} />
          {t('sidebar.nav.thisWeek')}
        </NavLink>
        <NavLink to="/tasks/inbox" className={navItemClass}>
          <Inbox size={18} />
          {t('sidebar.nav.inbox')}
        </NavLink>
        <NavLink to="/tasks" end className={navItemClass}>
          <ListTodo size={18} />
          {t('sidebar.nav.allTasks')}
        </NavLink>
        {featureVisibility.calendar && (
          <NavLink to="/calendar" className={navItemClass}>
            <CalendarDays size={18} />
            {t('sidebar.nav.calendar')}
          </NavLink>
        )}
        <NavLink to="/termine" className={navItemClass}>
          <CalendarClock size={18} />
          Termine
        </NavLink>
        {featureVisibility.eisenhower && (
          <NavLink to="/eisenhower" className={navItemClass}>
            <Grid2x2 size={18} />
            {t('sidebar.nav.eisenhower')}
          </NavLink>
        )}
        {featureVisibility.worktime && (
          <NavLink to="/arbeitszeit" className={navItemClass}>
            <Clock size={18} />
            {t('sidebar.nav.worktime')}
          </NavLink>
        )}
        {isSupabaseConfigured && featureVisibility.aiScheduler && (
          <NavLink to="/ki-termine" className={navItemClass}>
            <Sparkles size={18} />
            {t('sidebar.nav.aiScheduler')}
          </NavLink>
        )}
        {isSupabaseConfigured && featureVisibility.chat && (
          <NavLink to="/chat" className={navItemClass} onClick={onClose}>
            <span className="relative">
              <MessageCircle size={18} />
              {unreadMessages > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </span>
            {t('sidebar.nav.chat')}
          </NavLink>
        )}
        {isSupabaseConfigured && featureVisibility.friends && (
          <NavLink to="/friends" className={navItemClass}>
            <Users size={18} />
            {t('sidebar.nav.friends')}
          </NavLink>
        )}
        {isSupabaseConfigured && featureVisibility.social && (
          <NavLink to="/social" className={navItemClass}>
            <Instagram size={18} />
            {t('sidebar.nav.social')}
          </NavLink>
        )}
      </nav>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {t('sidebar.projects.title')}
          </span>
          <NavLink
            to="/projekte"
            onClick={onClose}
            className="text-gray-400 hover:text-accent"
            title={t('sidebar.projects.manage')}
          >
            <Plus size={16} />
          </NavLink>
        </div>
        <div className="flex flex-col gap-1">
          <NavLink to="/projekte" end className={navItemClass} onClick={onClose}>
            <Trello size={18} />
            {t('sidebar.projects.all')}
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
                      <span className="px-3 py-1.5 text-xs text-gray-400">{t('sidebar.projects.empty')}</span>
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
                alt={t('sidebar.profile.avatarAlt')}
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
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium">{profile.display_name}</p>
                {profile.id === '6e6370e8-4dfc-4226-b5d5-8bcb6b9273f1' && (
                  <span className="flex-shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
                    👑 Owner
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-gray-400">@{profile.username}</p>
            </div>
            <Settings size={16} className="flex-shrink-0 text-gray-400" />
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                signOut()
              }}
              title={t('sidebar.profile.signOut')}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600 dark:hover:bg-racing-700"
            >
              <LogOut size={16} />
            </button>
          </NavLink>
        )}
        <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-racing-800">
          <button
            onClick={() => setMode('light')}
            title={t('sidebar.theme.light')}
            aria-label={t('sidebar.theme.light')}
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
            title={t('sidebar.theme.dark')}
            aria-label={t('sidebar.theme.dark')}
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
            title={t('sidebar.theme.pink')}
            aria-label={t('sidebar.theme.pink')}
            className={`flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors ${
              pinkAccent
                ? 'bg-white text-gray-700 shadow-sm dark:bg-racing-700 dark:text-white'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-racing-100'
            }`}
          >
            <Sparkles size={16} />
          </button>
        </div>
        <div className="mt-2 flex justify-center gap-3 px-2 text-[11px] text-gray-400">
          <Link to="/datenschutz" target="_blank" className="hover:underline">{t('sidebar.legal.privacy')}</Link>
          <Link to="/impressum" target="_blank" className="hover:underline">{t('sidebar.legal.imprint')}</Link>
        </div>
      </div>
      </aside>
    </>
  )
}
