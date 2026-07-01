import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import MobileBottomNav from './MobileBottomNav'
import Logo from './Logo'
import GlobalSearch from './GlobalSearch'
import OfflineBanner from './OfflineBanner'
import ToastContainer from './ToastContainer'
import AiChatPanel from '../ai/AiChatPanel'
import ErrorBoundary from './ErrorBoundary'
import AppUpdater from './AppUpdater'

export default function Layout() {
  const { t } = useTranslation('layout')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ErrorBoundary>
      <OfflineBanner />
      <div className="flex h-screen w-full overflow-hidden">
        <GlobalSearch />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="vibrancy-header flex items-center gap-2 px-4 py-3 sm:hidden" style={{ paddingTop: 'max(12px, calc(12px + env(safe-area-inset-top)))' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-racing-100 dark:hover:bg-racing-800"
              aria-label={t('topbar.openMenu')}
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Logo />
              <span className="text-lg font-semibold">{t('appName')}</span>
            </div>
          </div>
          
          <main className="relative flex-1 overflow-y-auto">
            <AppUpdater />
            {/* Extra bottom padding on mobile so content clears the fixed bottom nav bar.
                overflow-x-hidden stops any too-wide child from making the whole page slide sideways. */}
            <div className="mx-auto h-full w-full max-w-7xl overflow-x-hidden p-4 pb-24 sm:p-6 sm:pb-6 lg:p-8 relative">
              <Outlet />
            </div>
          </main>
        </div>
        <MobileBottomNav />
      </div>
      <ToastContainer />
      <AiChatPanel />
    </ErrorBoundary>
  )
}
