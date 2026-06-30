import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, ListTodo, CalendarDays, Brain, Menu } from 'lucide-react'

interface MobileBottomNavProps {
  onOpenMenu: () => void
}

// One-tap primary navigation for phones (the drawer is still available via "Menü").
// Hidden on >= sm where the full sidebar is always visible.
export default function MobileBottomNav({ onOpenMenu }: MobileBottomNavProps) {
  const { t } = useTranslation('layout')

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${
      isActive ? 'text-accent' : 'text-gray-500 dark:text-racing-300'
    }`

  return (
    <nav
      className="vibrancy-header fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-gray-200/70 sm:hidden dark:border-racing-800"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <NavLink to="/" end className={itemClass}>
        <LayoutDashboard size={20} />
        <span>{t('sidebar.nav.dashboard')}</span>
      </NavLink>
      <NavLink to="/calendar" className={itemClass}>
        <CalendarDays size={20} />
        <span>{t('sidebar.nav.calendar')}</span>
      </NavLink>
      <NavLink to="/tasks" end className={itemClass}>
        <ListTodo size={20} />
        <span>{t('sidebar.nav.allTasks')}</span>
      </NavLink>
      <NavLink to="/gehirn" className={itemClass}>
        <Brain size={20} />
        <span>Gehirn</span>
      </NavLink>
      <button onClick={onOpenMenu} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-medium text-gray-500 dark:text-racing-300">
        <Menu size={20} />
        <span>{t('topbar.openMenu')}</span>
      </button>
    </nav>
  )
}
