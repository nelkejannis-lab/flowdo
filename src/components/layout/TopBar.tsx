import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Menu,
  PanelLeftClose,
  PanelLeft,
  Search,
  Bell,
  MessageCircle,
  Settings,
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  CalendarClock,
  Trello,
  Clock,
  Sparkles,
  Inbox,
  CheckCircle2,
  Grid2x2,
  Users,
  Instagram,
  Brain,
  Mic,
} from 'lucide-react'
import Logo from './Logo'
import { useSearchStore } from '../../store/searchStore'
import { useMessagesStore } from '../../store/messagesStore'
import { useSettingsStore, type NavItemKey } from '../../store/settingsStore'
import { useAuthStore } from '../../store/authStore'
import { useTaskSharesStore } from '../../store/taskSharesStore'
import { useBoardInvitesStore } from '../../store/boardInvitesStore'
import { useTeamInvitesStore } from '../../store/teamInvitesStore'
import { useNotificationsStore } from '../../store/notificationsStore'
import { isSupabaseConfigured } from '../../lib/supabase'

const NAV_ICONS: Record<NavItemKey, React.ReactNode> = {
  dashboard: <LayoutDashboard size={18} strokeWidth={1.6} />,
  week: <CheckCircle2 size={18} strokeWidth={1.6} />,
  inbox: <Inbox size={18} strokeWidth={1.6} />,
  tasks: <ListTodo size={18} strokeWidth={1.6} />,
  calendar: <CalendarDays size={18} strokeWidth={1.6} />,
  termine: <CalendarClock size={18} strokeWidth={1.6} />,
  brain: <Brain size={18} strokeWidth={1.6} />,
  memory: <MessageCircle size={18} strokeWidth={1.6} />,
  eisenhower: <Grid2x2 size={18} strokeWidth={1.6} />,
  worktime: <Clock size={18} strokeWidth={1.6} />,
  aiScheduler: <Sparkles size={18} strokeWidth={1.6} />,
  chat: <MessageCircle size={18} strokeWidth={1.6} />,
  friends: <Users size={18} strokeWidth={1.6} />,
  social: <Instagram size={18} strokeWidth={1.6} />,
  meetings: <Mic size={18} strokeWidth={1.6} />,
  projekte: <Trello size={18} strokeWidth={1.6} />,
}

const NAV_PATHS: Record<NavItemKey, { to: string; exact?: boolean }> = {
  dashboard: { to: '/', exact: true },
  week: { to: '/tasks/week' },
  inbox: { to: '/tasks/inbox' },
  tasks: { to: '/tasks', exact: true },
  calendar: { to: '/calendar' },
  termine: { to: '/termine' },
  brain: { to: '/creative-board' },
  memory: { to: '/memory' },
  eisenhower: { to: '/eisenhower' },
  worktime: { to: '/arbeitszeit' },
  aiScheduler: { to: '/ki-termine' },
  chat: { to: '/chat' },
  friends: { to: '/friends' },
  social: { to: '/social' },
  meetings: { to: '/meetings' },
  projekte: { to: '/projekte', exact: true },
}

interface TopBarProps {
  menuOpen: boolean
  onToggleMenu: () => void
}

export default function TopBar({ menuOpen, onToggleMenu }: TopBarProps) {
  const { t } = useTranslation('layout')
  const openSearch = useSearchStore((s) => s.open)
  const unreadMessages = useMessagesStore((s) => s.unreadTotal)
  const featureVisibility = useSettingsStore((s) => s.featureVisibility)
  const pinnedNavItems = useSettingsStore((s) => s.pinnedNavItems ?? [])
  const menuCollapsed = useSettingsStore((s) => s.menuCollapsed)
  const toggleMenuCollapsed = useSettingsStore((s) => s.toggleMenuCollapsed)
  const profile = useAuthStore((s) => s.profile)
  const taskIncoming = useTaskSharesStore((s) => s.incoming ?? [])
  const boardIncoming = useBoardInvitesStore((s) => s.incoming ?? [])
  const teamIncoming = useTeamInvitesStore((s) => s.incoming ?? [])
  const unreadNotifications = useNotificationsStore((s) => s.unreadCount)
  const notificationCount = taskIncoming.length + boardIncoming.length + teamIncoming.length + unreadNotifications

  const pinKeys = (pinnedNavItems.length > 0 ? pinnedNavItems : (['tasks', 'calendar', 'projekte'] as NavItemKey[]))
    .filter((k) => k !== 'dashboard')
    .slice(0, 8)

  const utilBtn =
    'relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-black/[0.05] hover:text-gray-800 dark:text-racing-300 dark:hover:bg-white/[0.06] dark:hover:text-white'

  return (
    <header
      className="vibrancy-header relative z-30 flex h-14 flex-shrink-0 items-center gap-3 px-3 sm:px-4"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left: menu + brand */}
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onToggleMenu}
          className={utilBtn}
          aria-label={menuOpen ? t('topbar.closeMenu') : t('topbar.openMenu')}
          title={menuOpen ? t('topbar.closeMenu') : t('topbar.openMenu')}
        >
          <Menu size={20} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={toggleMenuCollapsed}
          className={`${utilBtn} hidden sm:flex`}
          aria-label={menuCollapsed ? t('topbar.showMenu') : t('topbar.hideMenu')}
          title={menuCollapsed ? t('topbar.showMenu') : t('topbar.hideMenu')}
        >
          {menuCollapsed ? <PanelLeft size={18} strokeWidth={1.6} /> : <PanelLeftClose size={18} strokeWidth={1.6} />}
        </button>
        <NavLink to="/" className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
          <Logo />
          <span className="hidden truncate text-[15px] font-semibold tracking-tight sm:inline">{t('appName')}</span>
        </NavLink>
      </div>

      {/* Center: pinned symbols */}
      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex" aria-label={t('topbar.pinnedNav')}>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
              isActive
                ? 'bg-accent/12 text-accent'
                : 'text-gray-500 hover:bg-black/[0.05] hover:text-gray-800 dark:text-racing-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
            }`
          }
          title={t('sidebar.nav.dashboard')}
        >
          {NAV_ICONS.dashboard}
        </NavLink>
        {pinKeys.map((key) => {
          const path = NAV_PATHS[key] ?? NAV_PATHS.dashboard
          const label =
            key === 'projekte'
              ? t('sidebar.projects.all')
              : t(`sidebar.nav.${key}` as 'sidebar.nav.tasks', { defaultValue: key })
          return (
            <NavLink
              key={key}
              to={path.to}
              end={path.exact}
              className={({ isActive }) =>
                `flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? 'bg-accent/12 text-accent'
                    : 'text-gray-500 hover:bg-black/[0.05] hover:text-gray-800 dark:text-racing-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
                }`
              }
              title={label}
            >
              {NAV_ICONS[key] ?? NAV_ICONS.dashboard}
            </NavLink>
          )
        })}
      </nav>

      {/* Right: utilities */}
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <button type="button" onClick={openSearch} className={utilBtn} aria-label={t('sidebar.search')} title={t('sidebar.searchTitle')}>
          <Search size={18} strokeWidth={1.6} />
        </button>
        <NavLink to="/tasks/inbox" className={utilBtn} aria-label={t('sidebar.inbox')}>
          <Bell size={18} strokeWidth={1.6} />
          {notificationCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
              {notificationCount > 9 ? '9+' : notificationCount}
            </span>
          )}
        </NavLink>
        {featureVisibility.chat && isSupabaseConfigured && (
          <NavLink to="/chat" className={utilBtn} aria-label={t('sidebar.chat')}>
            <MessageCircle size={18} strokeWidth={1.6} />
            {unreadMessages > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold text-white">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </NavLink>
        )}
        <NavLink to="/einstellungen" className={`${utilBtn} hidden sm:flex`} aria-label={t('topbar.settings')}>
          <Settings size={18} strokeWidth={1.6} />
        </NavLink>
        {isSupabaseConfigured && profile ? (
          <NavLink
            to="/einstellungen"
            className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
            title={profile.display_name}
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-white/60 dark:ring-white/10" />
            ) : (
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                style={{ backgroundColor: profile.avatar_color }}
              >
                {profile.display_name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <span className="hidden max-w-[100px] truncate text-xs font-medium text-gray-700 dark:text-racing-100 lg:inline">
              {profile.display_name}
            </span>
          </NavLink>
        ) : (
          <NavLink to="/einstellungen" className={utilBtn} aria-label={t('topbar.settings')}>
            <Settings size={18} strokeWidth={1.6} />
          </NavLink>
        )}
      </div>
    </header>
  )
}
