import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  CalendarClock,
  Trello,
  Clock,
  Sparkles,
  Inbox,
  Users,
  Instagram,
  Brain,
  Mic,
  MessageCircle,
  Settings,
  PanelLeft,
} from 'lucide-react'
import { useSettingsStore, type NavItemKey } from '../../store/settingsStore'
import { isSupabaseConfigured } from '../../lib/supabase'

const RAIL_ICONS: Partial<Record<NavItemKey, React.ReactNode>> = {
  dashboard: <LayoutDashboard size={20} strokeWidth={1.5} />,
  inbox: <Inbox size={20} strokeWidth={1.5} />,
  tasks: <ListTodo size={20} strokeWidth={1.5} />,
  calendar: <CalendarDays size={20} strokeWidth={1.5} />,
  termine: <CalendarClock size={20} strokeWidth={1.5} />,
  brain: <Brain size={20} strokeWidth={1.5} />,
  memory: <MessageCircle size={20} strokeWidth={1.5} />,
  worktime: <Clock size={20} strokeWidth={1.5} />,
  aiScheduler: <Sparkles size={20} strokeWidth={1.5} />,
  chat: <MessageCircle size={20} strokeWidth={1.5} />,
  friends: <Users size={20} strokeWidth={1.5} />,
  social: <Instagram size={20} strokeWidth={1.5} />,
  meetings: <Mic size={20} strokeWidth={1.5} />,
  projekte: <Trello size={20} strokeWidth={1.5} />,
}

const RAIL_PATHS: Partial<Record<NavItemKey, { to: string; exact?: boolean }>> = {
  dashboard: { to: '/', exact: true },
  inbox: { to: '/tasks/inbox' },
  tasks: { to: '/tasks', exact: true },
  calendar: { to: '/calendar' },
  termine: { to: '/termine' },
  brain: { to: '/creative-board' },
  memory: { to: '/memory' },
  worktime: { to: '/arbeitszeit' },
  aiScheduler: { to: '/ki-termine' },
  chat: { to: '/chat' },
  friends: { to: '/friends' },
  social: { to: '/social' },
  meetings: { to: '/meetings' },
  projekte: { to: '/projekte', exact: true },
}

const DEFAULT_RAIL: NavItemKey[] = ['dashboard', 'tasks', 'calendar', 'termine', 'projekte', 'worktime', 'meetings']

interface IconRailProps {
  onOpenMenu: () => void
}

export default function IconRail({ onOpenMenu }: IconRailProps) {
  const { t } = useTranslation('layout')
  const pinnedNavItems = useSettingsStore((s) => s.pinnedNavItems ?? [])
  const featureVisibility = useSettingsStore((s) => s.featureVisibility)
  const navVisibility = useSettingsStore((s) => s.navVisibility)
  const setMenuCollapsed = useSettingsStore((s) => s.setMenuCollapsed)

  const keys = (() => {
    const fromPins = pinnedNavItems.filter((k) => k !== 'dashboard' && RAIL_ICONS[k])
    const base = fromPins.length > 0 ? (['dashboard', ...fromPins] as NavItemKey[]) : DEFAULT_RAIL
    return base.filter((key) => {
      if (key === 'dashboard') return true
      if (key === 'aiScheduler' || key === 'chat' || key === 'friends' || key === 'social') {
        if (!isSupabaseConfigured) return false
      }
      if (key === 'calendar' && !featureVisibility.calendar) return false
      if (key === 'worktime' && !featureVisibility.worktime) return false
      if (key === 'aiScheduler' && !featureVisibility.aiScheduler) return false
      if (key === 'chat' && !featureVisibility.chat) return false
      if (key === 'friends' && !featureVisibility.friends) return false
      if (key === 'social' && !featureVisibility.social) return false
      return navVisibility?.[key] ?? true
    }).slice(0, 10)
  })()

  const railBtn = ({ isActive }: { isActive: boolean }) =>
    `flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
      isActive
        ? 'bg-accent text-white shadow-md shadow-accent/25'
        : 'text-gray-400 hover:bg-black/[0.05] hover:text-gray-700 dark:text-racing-400 dark:hover:bg-white/[0.07] dark:hover:text-white'
    }`

  return (
    <aside
      className="hidden h-full w-[68px] flex-shrink-0 flex-col items-center gap-1 border-r border-black/[0.04] bg-white/90 py-3 dark:border-white/[0.06] dark:bg-racing-900/80 sm:flex"
      aria-label={t('topbar.iconRail')}
    >
      <button
        type="button"
        onClick={() => {
          setMenuCollapsed(false)
          onOpenMenu()
        }}
        className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-black/[0.05] hover:text-gray-700 dark:hover:bg-white/[0.07] dark:hover:text-white"
        title={t('topbar.showMenu')}
        aria-label={t('topbar.showMenu')}
      >
        <PanelLeft size={20} strokeWidth={1.5} />
      </button>

      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto">
        {keys.map((key) => {
          const path = RAIL_PATHS[key]
          const icon = RAIL_ICONS[key]
          if (!path || !icon) return null
          const label =
            key === 'projekte'
              ? t('sidebar.projects.all')
              : t(`sidebar.nav.${key}` as 'sidebar.nav.tasks', { defaultValue: key })
          return (
            <NavLink key={key} to={path.to} end={path.exact} className={railBtn} title={label} aria-label={label}>
              {icon}
            </NavLink>
          )
        })}
      </nav>

      <NavLink to="/einstellungen" className={railBtn} title={t('topbar.settings')} aria-label={t('topbar.settings')}>
        <Settings size={20} strokeWidth={1.5} />
      </NavLink>
    </aside>
  )
}
