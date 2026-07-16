import { useEffect, useState } from 'react'
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

export default function Layout() {
  const menuCollapsed = useSettingsStore((s) => s.menuCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!menuCollapsed && typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches) {
      setDrawerOpen(true)
    }
  }, [menuCollapsed])

  function handleToggleMenu() {
    setDrawerOpen((v) => !v)
  }

  function handleCloseDrawer() {
    setDrawerOpen(false)
    if (!menuCollapsed) {
      useSettingsStore.getState().setMenuCollapsed(true)
    }
  }

  const showDocked = !menuCollapsed && drawerOpen

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <div className="flex h-screen w-full overflow-hidden">
        <GlobalSearch />
        <IconRail
          onOpenMenu={() => {
            useSettingsStore.getState().setMenuCollapsed(false)
            setDrawerOpen(true)
          }}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar menuOpen={drawerOpen} onToggleMenu={handleToggleMenu} />
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <Sidebar isOpen={drawerOpen} onClose={handleCloseDrawer} docked={showDocked} />
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
