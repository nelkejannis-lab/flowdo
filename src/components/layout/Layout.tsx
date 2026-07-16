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
 * Shell roles:
 * - IconRail (desktop): always mounted — slim pin/icon chrome + expand control.
 *   Collapse must NEVER unmount this; it is the collapsed navigation.
 * - Sidebar: full labelled menu only (docked when expanded, overlay on mobile).
 * - TopBar: brand, pin strip, search/utilities + expand/collapse.
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

  // Expanded = labelled sidebar docked. Collapsed = IconRail + TopBar pins only.
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
      // Only hide the labelled panel — IconRail / TopBar pins stay mounted.
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
        {/* Always render on desktop; collapse toggles Sidebar only */}
        <IconRail menuOpen={labelledMenuOpen} onToggleMenu={toggleMenu} onOpenMenu={openMenu} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar menuOpen={sidebarOpen} onToggleMenu={toggleMenu} />
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <Sidebar isOpen={sidebarOpen} onClose={closeMenu} docked={labelledMenuOpen} />
            <main className="relative flex-1 overflow-y-auto">
              <AppUpdater />
              {/* overflow-x-clip (not hidden) so position:sticky children can stick to main's scrollport */}
              <div className="mx-auto h-full w-full max-w-7xl overflow-x-clip p-4 pb-[max(6.5rem,calc(5.5rem+env(safe-area-inset-bottom)))] sm:p-6 sm:pb-6 lg:p-8 relative page-bg">
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
