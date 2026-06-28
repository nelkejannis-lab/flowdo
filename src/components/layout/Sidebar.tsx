import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink } from 'react-router-dom'
import Logo from './Logo'
import Modal from './Modal'
import { SHORTCUTS } from '../../hooks/useKeyboardShortcuts'
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  CalendarClock,
  Trello,
  Clock,
  Timer,
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
  GripVertical,
  Cloud,
  CloudOff,
  Keyboard,
  Brain,
  Mic,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { type NavItemKey, DEFAULT_NAV_ORDER } from '../../store/settingsStore'
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
  const [showShortcuts, setShowShortcuts] = useState(false)
  const boards = useBoardsStore((s) => s.boards)
  const folders = useBoardsStore((s) => s.folders)
  const taskStats = useBoardsStore((s) => s.taskStats)
  const fetchBoards = useBoardsStore((s) => s.fetchBoards)
  const fetchFolders = useBoardsStore((s) => s.fetchFolders)
  const subscribeToBoards = useBoardsStore((s) => s.subscribeToBoards)
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
  const navOrder = useSettingsStore((s) => s.navOrder ?? DEFAULT_NAV_ORDER)
  const setNavOrder = useSettingsStore((s) => s.setNavOrder)
  const navVisibility = useSettingsStore((s) => s.navVisibility)
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

  useEffect(() => {
    if (!isSupabaseConfigured) return
    return subscribeToBoards()
  }, [subscribeToBoards])

  // Self-heal stale persisted navOrder that predates newer nav items (e.g. worktime, pomodoro)
  useEffect(() => {
    const missing = DEFAULT_NAV_ORDER.filter((k) => !navOrder.includes(k))
    if (missing.length > 0) setNavOrder([...navOrder, ...missing])
  }, [navOrder, setNavOrder])

  const navSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleNavDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (over && active.id !== over.id) {
      const oldIndex = navOrder.indexOf(active.id as NavItemKey)
      const newIndex = navOrder.indexOf(over.id as NavItemKey)
      if (oldIndex !== -1 && newIndex !== -1) {
        setNavOrder(arrayMove(navOrder, oldIndex, newIndex))
      }
    }
  }

  // Full nav item definitions
  type NavDef = { key: NavItemKey; to: string; icon: React.ReactNode; label: React.ReactNode; visible: boolean; exact?: boolean }
  const allNavItems: NavDef[] = [
    { key: 'dashboard', to: '/', icon: <LayoutDashboard size={18} />, label: t('sidebar.nav.dashboard'), visible: true, exact: true },
    { key: 'week', to: '/tasks/week', icon: <CheckCircle2 size={18} />, label: t('sidebar.nav.thisWeek'), visible: true },
    { key: 'inbox', to: '/tasks/inbox', icon: <Inbox size={18} />, label: t('sidebar.nav.inbox'), visible: true },
    { key: 'tasks', to: '/tasks', icon: <ListTodo size={18} />, label: t('sidebar.nav.allTasks'), visible: true, exact: true },
    { key: 'calendar', to: '/calendar', icon: <CalendarDays size={18} />, label: t('sidebar.nav.calendar'), visible: !!featureVisibility.calendar },
    { key: 'termine', to: '/termine', icon: <CalendarClock size={18} />, label: 'Termine', visible: true },
    { key: 'pomodoro', to: '/pomodoro', icon: <Timer size={18} />, label: 'Pomodoro', visible: true },
    { key: 'brain', to: '/gehirn', icon: <Brain size={18} />, label: 'Gehirn', visible: true },
    { key: 'eisenhower', to: '/eisenhower', icon: <Grid2x2 size={18} />, label: t('sidebar.nav.eisenhower'), visible: !!featureVisibility.eisenhower },
    { key: 'worktime', to: '/arbeitszeit', icon: <Clock size={18} />, label: t('sidebar.nav.worktime'), visible: !!featureVisibility.worktime },
    { key: 'aiScheduler', to: '/ki-termine', icon: <Sparkles size={18} />, label: t('sidebar.nav.aiScheduler'), visible: isSupabaseConfigured && !!featureVisibility.aiScheduler },
    { key: 'chat', to: '/chat', icon: <MessageCircle size={18} />, label: t('sidebar.nav.chat'), visible: isSupabaseConfigured && !!featureVisibility.chat },
    { key: 'friends', to: '/friends', icon: <Users size={18} />, label: t('sidebar.nav.friends'), visible: isSupabaseConfigured && !!featureVisibility.friends },
    { key: 'social', to: '/social', icon: <Instagram size={18} />, label: t('sidebar.nav.social'), visible: isSupabaseConfigured && !!featureVisibility.social },
    { key: 'meetings', to: '/meetings', icon: <Mic size={18} />, label: 'Meetings', visible: true },
    { key: 'projekte', to: '/projekte', icon: <Trello size={18} />, label: t('sidebar.projects.all'), visible: true, exact: true },
  ]
  const navItemMap = Object.fromEntries(allNavItems.map((n) => [n.key, n])) as Record<NavItemKey, NavDef>
  const sortedNavItems = navOrder.map((k) => navItemMap[k]).filter(Boolean).filter((item) => {
    // Always show dashboard + calendar; for others check navVisibility
    if (item.key === 'dashboard' || item.key === 'calendar') return item.visible
    return (navVisibility?.[item.key] ?? true) && item.visible
  })

  // Group the nav into labelled sections so it reads as a few short lists instead of one
  // long undifferentiated column. Membership is fixed per group; the order WITHIN a group
  // still follows navOrder, so drag-to-reorder (within a group) keeps working.
  const NAV_GROUPS: { id: string; label: string | null; keys: NavItemKey[] }[] = [
    { id: 'home', label: null, keys: ['dashboard'] },
    { id: 'tasks', label: t('sidebar.groups.tasks'), keys: ['week', 'inbox', 'tasks', 'eisenhower', 'brain', 'projekte'] },
    { id: 'planning', label: t('sidebar.groups.planning'), keys: ['calendar', 'termine', 'pomodoro', 'worktime', 'aiScheduler', 'meetings'] },
    { id: 'team', label: t('sidebar.groups.team'), keys: ['chat', 'friends', 'social'] },
  ]
  const visibleNavItems = sortedNavItems.filter((item) => item.visible)
  const usedKeys = new Set<string>()
  const navGroups = NAV_GROUPS.map((group) => {
    // Filter visibleNavItems (already in navOrder order) by this group's membership.
    const items = visibleNavItems.filter((item) => group.keys.includes(item.key))
    items.forEach((item) => usedKeys.add(item.key))
    return { ...group, items }
  }).filter((group) => group.items.length > 0)
  // Any visible item not assigned to a group (e.g. a future nav key) falls into a "more" bucket.
  const leftovers = visibleNavItems.filter((item) => !usedKeys.has(item.key))
  if (leftovers.length > 0) {
    navGroups.push({ id: 'more', label: t('sidebar.groups.more'), keys: leftovers.map((i) => i.key), items: leftovers })
  }

  function renderNavItemChildren(item: NavDef) {
    return (
      <>
        {item.key === 'chat' ? (
          <span className="relative flex-shrink-0">{item.icon}
            {unreadMessages > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </span>
        ) : (
          <span className="flex-shrink-0">{item.icon}</span>
        )}
        <span className="flex-1 truncate">{item.label}</span>
      </>
    )
  }

  function toggleFolder(id: string) {
    setOpenFolders((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const syncStatus = (() => {
    if (!isSupabaseConfigured) {
      return {
        icon: <CloudOff size={16} className="text-gray-400" />,
        tooltip: 'Offline-Modus / Local-Only',
      }
    }
    if (profile) {
      return {
        icon: <Cloud size={16} className="text-emerald-500 animate-pulse" style={{ animationDuration: '3s' }} />,
        tooltip: 'Synchronisiert mit der Cloud',
      }
    }
    return {
      icon: <Cloud size={16} className="text-amber-500" />,
      tooltip: 'Nicht angemeldet – Lokaler Modus',
    }
  })()

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
        style={{ paddingTop: 'max(16px, calc(16px + env(safe-area-inset-top)))', paddingBottom: 'max(16px, calc(16px + env(safe-area-inset-bottom)))' }}
        className={`vibrancy-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col overflow-y-auto px-3 transition-transform duration-300 sm:static sm:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
      <div className="mb-6 flex items-center justify-between gap-1 px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Logo />
          <span className="truncate text-base font-semibold sm:text-lg">{t('appName')}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-0">
          <div
            className="flex items-center justify-center p-1 text-gray-400"
            title={syncStatus.tooltip}
            aria-label={syncStatus.tooltip}
          >
            {syncStatus.icon}
          </div>
          <button
            onClick={() => setShowShortcuts(true)}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-racing-800"
            title="Tastaturkurzbefehle / Keyboard Shortcuts"
            aria-label="Tastaturkurzbefehle / Keyboard Shortcuts"
          >
            <Keyboard size={16} />
          </button>
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

      <DndContext sensors={navSensors} collisionDetection={closestCenter} onDragEnd={handleNavDragEnd}>
        <nav className="flex flex-col gap-4">
          {navGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-0.5">
              {group.label && (
                <span className="px-3 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400/80">
                  {group.label}
                </span>
              )}
              <SortableContext items={group.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
                {group.items.map((item) => (
                  <SortableNavItem key={item.key} id={item.key} to={item.to} exact={item.exact} onClose={onClose}>
                    {renderNavItemChildren(item)}
                  </SortableNavItem>
                ))}
              </SortableContext>
            </div>
          ))}
        </nav>
      </DndContext>

      <div className="mt-4">
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
                          <BoardProgressPie color={board.color} stats={taskStats[board.id]} />
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
              <BoardProgressPie color={board.color} stats={taskStats[board.id]} />
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
        <p className="mt-1 text-center text-[10px] text-gray-300 dark:text-racing-600">v{__APP_VERSION__}</p>
      </div>
      </aside>
      {showShortcuts && (
        <Modal title="Tastaturkurzbefehle" onClose={() => setShowShortcuts(false)} widthClass="max-w-md">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-500 dark:text-racing-200">
              Drücke diese Tasten, wenn kein Eingabefeld fokussiert ist.
            </p>
            <div className="divide-y divide-gray-100 dark:divide-racing-800">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between py-2 text-sm text-gray-700 dark:text-racing-100">
                  <span>{s.description}</span>
                  <kbd className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs font-semibold text-gray-800 shadow-sm dark:border-racing-700 dark:bg-racing-850 dark:text-racing-100">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

interface SortableNavItemProps {
  id: string
  to: string
  exact?: boolean
  onClose: () => void
  children: React.ReactNode
}

function SortableNavItem({ id, to, exact, onClose, children }: SortableNavItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-accent/10 text-accent shadow-sm'
        : 'text-gray-600 hover:bg-black/[0.04] dark:text-racing-100 dark:hover:bg-white/[0.06]'
    }`

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group relative flex items-center"
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute left-0 z-10 flex cursor-grab items-center justify-center rounded p-1 opacity-0 group-hover:opacity-40 hover:!opacity-80 active:cursor-grabbing touch-none"
        style={{ left: -2 }}
        tabIndex={-1}
        onClick={(e) => e.preventDefault()}
      >
        <GripVertical size={12} className="text-gray-400" />
      </button>
      <NavLink to={to} end={exact} className={navItemClass} onClick={onClose} style={{ paddingLeft: '12px', flex: 1 }}>
        {children}
      </NavLink>
    </div>
  )
}

function BoardProgressPie({ color, stats }: { color: string; stats?: { total: number; done: number } }) {
  if (!stats || stats.total === 0) {
    return <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
  }
  const percent = Math.min(100, Math.max(0, Math.round((stats.done / stats.total) * 100)))
  return (
    <div className="relative flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center" title={`${percent}% abgeschlossen (${stats.done}/${stats.total})`}>
      <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-gray-200 dark:stroke-racing-700" strokeWidth="6" />
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${percent}, 100`} strokeLinecap="round" className="transition-all duration-500 ease-out" />
      </svg>
    </div>
  )
}
