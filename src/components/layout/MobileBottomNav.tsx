import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, ListTodo, CalendarDays, Brain, Plus, CheckSquare, CalendarClock } from 'lucide-react'
import TaskFormModal from '../tasks/TaskFormModal'
import CalendarEntryFormModal from '../calendar/CalendarEntryFormModal'

// One-tap primary navigation for phones (the full drawer is reached via the top-left
// hamburger, so it doesn't need its own slot here). Floating glass pill with a raised
// center quick-add button, modeled after the reference design's wallet nav bar.
// Hidden on >= sm where the full sidebar is always visible.
export default function MobileBottomNav() {
  const { t } = useTranslation('layout')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [showEntryForm, setShowEntryForm] = useState(false)

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
      isActive ? 'text-accent' : 'text-gray-400 dark:text-racing-400'
    }`

  return (
    <>
      <nav
        className="glass-card fixed inset-x-3 bottom-3 z-40 flex items-stretch rounded-full px-2 sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <NavLink to="/" end className={itemClass}>
          <LayoutDashboard size={20} />
          <span>{t('sidebar.nav.dashboard')}</span>
        </NavLink>
        <NavLink to="/calendar" className={itemClass}>
          <CalendarDays size={20} />
          <span>{t('sidebar.nav.calendar')}</span>
        </NavLink>

        {/* Raised quick-add button, floats above the pill */}
        <div className="relative flex flex-1 items-center justify-center">
          <button
            onClick={() => setQuickAddOpen((v) => !v)}
            className="absolute -top-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform active:scale-95"
            aria-label={t('quickAdd.title')}
          >
            <Plus size={24} className={`transition-transform duration-200 ${quickAddOpen ? 'rotate-45' : ''}`} />
          </button>
        </div>

        <NavLink to="/tasks" end className={itemClass}>
          <ListTodo size={20} />
          <span>{t('sidebar.nav.allTasks')}</span>
        </NavLink>
        <NavLink to="/creative-board" className={itemClass}>
          <Brain size={20} />
          <span>{t('sidebar.nav.brain')}</span>
        </NavLink>
      </nav>

      {/* Quick-add popover */}
      {quickAddOpen && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setQuickAddOpen(false)} />
          <div
            className="glass-card fixed inset-x-3 z-40 flex flex-col gap-1.5 rounded-2xl p-2 sm:hidden"
            style={{ bottom: 'calc(3rem + env(safe-area-inset-bottom) + 44px)' }}
          >
            <button
              onClick={() => { setShowTaskForm(true); setQuickAddOpen(false) }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-black/[0.04] dark:text-racing-100 dark:hover:bg-white/[0.06]"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <CheckSquare size={16} />
              </span>
              {t('quickAdd.task')}
            </button>
            <button
              onClick={() => { setShowEntryForm(true); setQuickAddOpen(false) }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-black/[0.04] dark:text-racing-100 dark:hover:bg-white/[0.06]"
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <CalendarClock size={16} />
              </span>
              {t('quickAdd.entry')}
            </button>
          </div>
        </>
      )}

      {showTaskForm && <TaskFormModal onClose={() => setShowTaskForm(false)} />}
      {showEntryForm && <CalendarEntryFormModal onClose={() => setShowEntryForm(false)} />}
    </>
  )
}
