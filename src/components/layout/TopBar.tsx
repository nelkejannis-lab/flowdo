import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Menu,
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
  ChevronRight,
  ChevronLeft,
  PanelLeft,
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
import { PRIMARY_NAV_KEYS, NAV_PATHS, MAX_TOPBAR_PINS } from './navConfig'

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

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)

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
  const navVisibility = useSettingsStore((s) => s.navVisibility)
  const profile = useAuthStore((s) => s.profile)
  const taskIncoming = useTaskSharesStore((s) => s.incoming ?? [])
  const boardIncoming = useBoardInvitesStore((s) => s.incoming ?? [])
  const teamIncoming = useTeamInvitesStore((s) => s.incoming ?? [])
  const unreadNotifications = useNotificationsStore((s) => s.unreadCount)
  const notificationCount = taskIncoming.length + boardIncoming.length + teamIncoming.length + unreadNotifications

  // Pins that aren't already in the icon rail — avoids duplicate primary nav.
  const primarySet = new Set(PRIMARY_NAV_KEYS)
  const pinKeys = pinnedNavItems
    .filter((k) => k !== 'dashboard' && !primarySet.has(k))
    .filter((k) => {
      if (k === 'calendar' && !featureVisibility.calendar) return false
      if (k === 'worktime' && !featureVisibility.worktime) return false
      if (k === 'eisenhower' && !featureVisibility.eisenhower) return false
      if (k === 'aiScheduler' && !featureVisibility.aiScheduler) return false
      if (k === 'chat' && !featureVisibility.chat) return false
      if (k === 'friends' && !featureVisibility.friends) return false
      if (k === 'social' && !featureVisibility.social) return false
      if ((k === 'aiScheduler' || k === 'chat' || k === 'friends' || k === 'social') && !isSupabaseConfigured) {
        return false
      }
      return navVisibility?.[k] ?? true
    })
    .slice(0, MAX_TOPBAR_PINS)

  const utilBtn =
    'relative flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-black/[0.05] hover:text-gray-800 dark:text-racing-300 dark:hover:bg-white/[0.06] dark:hover:text-white'

  const pinBtn = ({ isActive }: { isActive: boolean }) =>
    `relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
      isActive
        ? 'bg-accent/12 text-accent'
        : 'text-gray-500 hover:bg-black/[0.05] hover:text-gray-800 dark:text-racing-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
    }`

  return (
    <header
      className="vibrancy-header relative z-30 flex h-14 flex-shrink-0 items-center gap-3 px-3 sm:px-4"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {/* Left: expand/collapse + brand */}
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onToggleMenu}
          className={`${utilBtn} sm:hidden`}
          aria-label={menuOpen ? t('topbar.closeMenu') : t('topbar.openMenu')}
          title={menuOpen ? t('topbar.closeMenu') : t('topbar.openMenu')}
          aria-expanded={menuOpen}
        >
          <Menu size={20} strokeWidth={1.6} />
        </button>
        <button
          type="button"
          onClick={onToggleMenu}
          className={`hidden items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium transition-colors sm:flex ${
            menuOpen
              ? 'bg-accent/10 text-accent hover:bg-accent/15'
              : 'bg-black/[0.04] text-gray-600 hover:bg-black/[0.07] hover:text-gray-900 dark:bg-white/[0.06] dark:text-racing-200 dark:hover:bg-white/[0.1] dark:hover:text-white'
          }`}
          aria-label={menuOpen ? t('topbar.collapseMenu') : t('topbar.expandMenu')}
          title={menuOpen ? t('topbar.collapseMenu') : t('topbar.expandMenu')}
          aria-expanded={menuOpen}
        >
          <PanelLeft size={16} strokeWidth={1.7} />
          <span className="hidden lg:inline">{menuOpen ? t('topbar.collapseShort') : t('topbar.expandShort')}</span>
          {menuOpen ? <ChevronLeft size={14} strokeWidth={2} /> : <ChevronRight size={14} strokeWidth={2} />}
        </button>
        <NavLink
          to="/"
          className="flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        >
          <Logo />
          <span className="hidden truncate text-[15px] font-semibold tracking-tight sm:inline">{t('appName')}</span>
        </NavLink>
      </div>

      {/* Center: non-primary pin shortcuts only */}
      {pinKeys.length > 0 && (
        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 md:flex"
          aria-label={t('topbar.pinnedNav')}
        >
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
                className={pinBtn}
                title={label}
                aria-label={label}
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span
                        className="absolute bottom-0.5 left-1/2 h-0.5 w-3.5 -translate-x-1/2 rounded-full bg-accent"
                        aria-hidden
                      />
                    )}
                    {NAV_ICONS[key] ?? NAV_ICONS.dashboard}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>
      )}

      {/* Right: utilities — Cmd/Ctrl+K remains primary search */}
      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={openSearch}
          className="hidden h-9 items-center gap-2 rounded-xl border border-black/[0.06] bg-black/[0.03] px-3 text-sm text-gray-500 transition-colors hover:bg-black/[0.05] hover:text-gray-800 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-racing-300 dark:hover:bg-white/[0.07] dark:hover:text-white md:flex"
          aria-label={t('sidebar.search')}
          title={t('sidebar.searchTitle')}
        >
          <Search size={15} strokeWidth={1.6} />
          <span className="max-w-[120px] truncate lg:max-w-none">{t('sidebar.search')}</span>
          <kbd className="ml-1 hidden rounded-md border border-black/[0.08] bg-white/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-400 dark:border-white/[0.1] dark:bg-racing-800 dark:text-racing-400 lg:inline">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>
        <button type="button" onClick={openSearch} className={`${utilBtn} md:hidden`} aria-label={t('sidebar.search')} title={t('sidebar.searchTitle')}>
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
          <NavLink to="/einstellungen" className={`${utilBtn} sm:hidden`} aria-label={t('topbar.settings')}>
            <Settings size={18} strokeWidth={1.6} />
          </NavLink>
        )}
      </div>
    </header>
  )
}
