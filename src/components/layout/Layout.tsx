import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import IconRail from './IconRail'
import MobileBottomNav from './MobileBottomNav'
import GlobalSearch from './GlobalSearch'
import OfflineBanner from './OfflineBanner'
import ToastContainer from './ToastContainer'
import AiChatPanel from '../ai/AiChatPanel'
import ErrorBoundary from './ErrorBoundary'
import AppUpdater from './AppUpdater'
import PageTransition from '../motion/PageTransition'
import { ShellChrome, ShellMain } from '../motion/ShellEntrance'
import { useSettingsStore } from '../../store/settingsStore'

/**
 * Shell roles (mutually exclusive on desktop — never both at once):
 * - Collapsed: IconRail only (60px pin/icon chrome + expand). Never disappears.
 * - Expanded: labelled Sidebar only (docked 272px + collapse). IconRail width collapses to 0.
 * - Mobile: overlay Sidebar + bottom nav; IconRail hidden via sm: breakpoint.
 */
export default function Layout() {
  const menuCollapsed = useSettingsStore((s) => s.menuCollapsed)
  const setMenuCollapsed = useSettingsStore((s) => s.setMenuCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : true
  )
  const reduce = useReducedMotion()

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const onChange = () => {
      setDesktop(mq.matches)
      if (!mq.matches) setMobileOpen(false)
    }
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const labelledMenuOpen = desktop && !menuCollapsed
  const sidebarOpen = labelledMenuOpen || mobileOpen

  const openMenu = useCallback(() => {
    if (desktop) {
      setMenuCollapsed(false)
    } else {
      setMobileOpen(true)
    }
  }, [desktop, setMenuCollapsed])

  const closeMenu = useCallback(() => {
    if (desktop) {
      setMenuCollapsed(true)
    } else {
      setMobileOpen(false)
    }
  }, [desktop, setMenuCollapsed])

  const toggleMenu = useCallback(() => {
    if (desktop) {
      setMenuCollapsed(!useSettingsStore.getState().menuCollapsed)
    } else {
      setMobileOpen((v) => !v)
    }
  }, [desktop, setMenuCollapsed])

  return (
    <ErrorBoundary>
      <OfflineBanner />
      {/* Opacity-only shell entrance — no transform on ancestors of sticky Quick Add. */}
      <motion.div
        className="flex h-screen w-full overflow-hidden"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <GlobalSearch />
        <IconRail collapsed={!labelledMenuOpen} onToggleMenu={toggleMenu} onOpenMenu={openMenu} />
        <Sidebar isOpen={sidebarOpen} onClose={closeMenu} docked={desktop} />
        <ShellMain className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ShellChrome delay={0.06}>
            <TopBar menuOpen={sidebarOpen} onToggleMenu={toggleMenu} />
          </ShellChrome>
          <main className="relative flex-1 overflow-y-auto overflow-x-hidden">
            <AppUpdater />
            <div className="relative mx-auto w-full max-w-7xl p-4 pb-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))] page-bg sm:p-6 sm:pb-6 lg:p-8">
              <PageTransition />
            </div>
          </main>
        </ShellMain>
        <MobileBottomNav />
      </motion.div>
      <ToastContainer />
      <AiChatPanel />
    </ErrorBoundary>
  )
}
