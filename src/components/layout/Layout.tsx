import { useCallback, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
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
import { useSettingsStore } from '../../store/settingsStore'

/**
 * Shell roles (Linear / Notion pattern):
 * - IconRail: few primary destinations + "Mehr"
 * - Sidebar: full labelled menu (docked on desktop when expanded, overlay otherwise)
 * - TopBar: brand, optional non-primary pins, search/utilities
 * - MobileBottomNav: four primaries + quick-add
 */
export default function Layout() {
  const menuCollapsed = useSettingsStore((s) => s.menuCollapsed)
  const setMenuCollapsed = useSettingsStore((s) => s.setMenuCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktop, setDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : true
  )

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

  // Docked full menu on desktop when user prefers it expanded (persisted).
  const docked = desktop && !menuCollapsed
  const sidebarOpen = docked || mobileOpen

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
      <div className="flex h-screen w-full overflow-hidden">
        <GlobalSearch />
        <IconRail menuOpen={docked} onToggleMenu={toggleMenu} onOpenMenu={openMenu} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar menuOpen={sidebarOpen} onToggleMenu={toggleMenu} />
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <Sidebar isOpen={sidebarOpen} onClose={closeMenu} docked={docked} />
            <main className="relative flex-1 overflow-y-auto">
              <AppUpdater />
              <div className="mx-auto h-full w-full max-w-7xl overflow-x-hidden p-4 pb-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))] sm:p-6 sm:pb-6 lg:p-8 relative page-bg">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
        <MobileBottomNav />
      </div>
      <ToastContainer />
      <AiChatPanel />
    </ErrorBoundary>
  )
}
