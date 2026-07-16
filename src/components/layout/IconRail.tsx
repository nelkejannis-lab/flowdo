import { useEffect, useRef, useState } from 'react'
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
  ChevronRight,
  ChevronLeft,
  Ellipsis,
  Grid2x2,
  CheckCircle2,
} from 'lucide-react'
import { useSettingsStore, type NavItemKey } from '../../store/settingsStore'
import { isSupabaseConfigured } from '../../lib/supabase'
import { NAV_PATHS } from './navConfig'

const RAIL_ICONS: Partial<Record<NavItemKey, React.ReactNode>> = {
  dashboard: <LayoutDashboard size={20} strokeWidth={1.5} />,
  week: <CheckCircle2 size={20} strokeWidth={1.5} />,
  inbox: <Inbox size={20} strokeWidth={1.5} />,
  tasks: <ListTodo size={20} strokeWidth={1.5} />,
  calendar: <CalendarDays size={20} strokeWidth={1.5} />,
  termine: <CalendarClock size={20} strokeWidth={1.5} />,
  brain: <Brain size={20} strokeWidth={1.5} />,
  memory: <MessageCircle size={20} strokeWidth={1.5} />,
  eisenhower: <Grid2x2 size={20} strokeWidth={1.5} />,
  worktime: <Clock size={20} strokeWidth={1.5} />,
  aiScheduler: <Sparkles size={20} strokeWidth={1.5} />,
  chat: <MessageCircle size={20} strokeWidth={1.5} />,
  friends: <Users size={20} strokeWidth={1.5} />,
  social: <Instagram size={20} strokeWidth={1.5} />,
  meetings: <Mic size={20} strokeWidth={1.5} />,
  projekte: <Trello size={20} strokeWidth={1.5} />,
}

const DEFAULT_RAIL: NavItemKey[] = ['dashboard', 'tasks', 'calendar', 'termine', 'projekte', 'worktime', 'meetings']
const MAX_RAIL_ITEMS = 10

interface IconRailProps {
  menuOpen: boolean
  onToggleMenu: () => void
  onOpenMenu: () => void
}

function isKeyVisible(
  key: NavItemKey,
  featureVisibility: ReturnType<typeof useSettingsStore.getState>['featureVisibility'],
  navVisibility: ReturnType<typeof useSettingsStore.getState>['navVisibility']
): boolean {
  if (key === 'dashboard') return true
  if (key === 'aiScheduler' || key === 'chat' || key === 'friends' || key === 'social') {
    if (!isSupabaseConfigured) return false
  }
  if (key === 'calendar' && !featureVisibility.calendar) return false
  if (key === 'worktime' && !featureVisibility.worktime) return false
  if (key === 'eisenhower' && !featureVisibility.eisenhower) return false
  if (key === 'aiScheduler' && !featureVisibility.aiScheduler) return false
  if (key === 'chat' && !featureVisibility.chat) return false
  if (key === 'friends' && !featureVisibility.friends) return false
  if (key === 'social' && !featureVisibility.social) return false
  return navVisibility?.[key] ?? true
}

/**
 * Slim desktop nav chrome — always visible on sm+.
 * Collapse only hides the labelled Sidebar; this rail (with pins) stays.
 */
export default function IconRail({ menuOpen, onToggleMenu, onOpenMenu }: IconRailProps) {
  const { t } = useTranslation('layout')
  const pinnedNavItems = useSettingsStore((s) => s.pinnedNavItems ?? [])
  const featureVisibility = useSettingsStore((s) => s.featureVisibility)
  const navVisibility = useSettingsStore((s) => s.navVisibility)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    function onDoc(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [moreOpen])

  useEffect(() => {
    if (menuOpen) setMoreOpen(false)
  }, [menuOpen])

  // Prefer user pins; fall back to a sensible default rail. Never empty.
  const keys = (() => {
    const fromPins = pinnedNavItems.filter((k) => k !== 'dashboard' && RAIL_ICONS[k])
    const base = fromPins.length > 0 ? (['dashboard', ...fromPins] as NavItemKey[]) : DEFAULT_RAIL
    return base
      .filter((key) => RAIL_ICONS[key] && isKeyVisible(key, featureVisibility, navVisibility))
      .slice(0, MAX_RAIL_ITEMS)
  })()

  const railBtn = ({ isActive }: { isActive: boolean }) =>
    `group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
      isActive
        ? 'bg-accent/12 text-accent'
        : 'text-gray-400 hover:bg-black/[0.05] hover:text-gray-700 dark:text-racing-400 dark:hover:bg-white/[0.07] dark:hover:text-white'
    }`

  return (
    <aside
      className="relative z-20 hidden h-full w-[60px] flex-shrink-0 flex-col items-center gap-0.5 border-r border-black/[0.04] bg-white/90 py-3 dark:border-white/[0.06] dark:bg-racing-900/80 sm:flex"
      aria-label={t('topbar.iconRail')}
      data-menu-collapsed={!menuOpen ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={onToggleMenu}
        className={`relative mb-2 flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
          menuOpen
            ? 'bg-accent/12 text-accent ring-1 ring-accent/25'
            : 'bg-accent text-white shadow-md shadow-accent/30 hover:brightness-110'
        }`}
        title={menuOpen ? t('topbar.collapseMenu') : t('topbar.expandMenu')}
        aria-label={menuOpen ? t('topbar.collapseMenu') : t('topbar.expandMenu')}
        aria-pressed={menuOpen}
        aria-expanded={menuOpen}
      >
        {menuOpen ? <ChevronLeft size={22} strokeWidth={2} /> : <ChevronRight size={22} strokeWidth={2.2} />}
      </button>

      <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto" aria-label={t('topbar.pinnedNav')}>
        {keys.map((key) => {
          const path = NAV_PATHS[key]
          const icon = RAIL_ICONS[key]
          if (!path || !icon) return null
          const label =
            key === 'projekte'
              ? t('sidebar.projects.all')
              : t(`sidebar.nav.${key}` as 'sidebar.nav.tasks', { defaultValue: key })
          return (
            <NavLink key={key} to={path.to} end={path.exact} className={railBtn} title={label} aria-label={label}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
                      aria-hidden
                    />
                  )}
                  {icon}
                </>
              )}
            </NavLink>
          )
        })}

        <div className="relative mt-1" ref={moreRef}>
          <button
            type="button"
            onClick={() => {
              setMoreOpen(false)
              onOpenMenu()
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setMoreOpen((v) => !v)
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 ${
              menuOpen
                ? 'bg-black/[0.05] text-gray-700 dark:bg-white/[0.07] dark:text-white'
                : 'text-gray-400 hover:bg-black/[0.05] hover:text-gray-700 dark:text-racing-400 dark:hover:bg-white/[0.07] dark:hover:text-white'
            }`}
            title={t('topbar.moreExpand')}
            aria-label={t('topbar.moreExpand')}
            aria-expanded={menuOpen}
          >
            <Ellipsis size={20} strokeWidth={1.5} />
          </button>

          {moreOpen && !menuOpen && (
            <div
              className="absolute left-full top-0 z-50 ml-2 min-w-[168px] rounded-2xl border border-black/[0.06] bg-white/95 p-1.5 shadow-bento-lg backdrop-blur-xl dark:border-white/[0.08] dark:bg-racing-900/95"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpen(false)
                  onOpenMenu()
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-accent hover:bg-accent/10"
              >
                <ChevronRight size={16} strokeWidth={2} />
                {t('topbar.expandMenu')}
              </button>
            </div>
          )}
        </div>
      </nav>

      <NavLink to="/einstellungen" className={railBtn} title={t('topbar.settings')} aria-label={t('topbar.settings')}>
        {({ isActive }) => (
          <>
            {isActive && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-accent" aria-hidden />
            )}
            <Settings size={20} strokeWidth={1.5} />
          </>
        )}
      </NavLink>

      {!menuOpen && (
        <button
          type="button"
          onClick={onOpenMenu}
          className="absolute -right-3 top-1/2 z-20 flex h-10 w-3 -translate-y-1/2 items-center justify-center rounded-r-md border border-l-0 border-black/[0.08] bg-white text-accent shadow-sm transition-transform hover:w-4 dark:border-white/[0.12] dark:bg-racing-900"
          title={t('topbar.expandMenu')}
          aria-label={t('topbar.expandMenu')}
        >
          <ChevronRight size={12} strokeWidth={2.5} />
        </button>
      )}
    </aside>
  )
}
