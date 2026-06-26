import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import Logo from './Logo'
import GlobalSearch from './GlobalSearch'
import OfflineBanner from './OfflineBanner'
import ToastContainer from './ToastContainer'
import AiChatPanel from '../ai/AiChatPanel'
import QuickTaskModal from './QuickTaskModal'
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
            <Logo size="sm" />
            <span className="text-base font-semibold">{t('appName')}</span>
          </div>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <ToastContainer />
      <AiChatPanel />

      {/* Magic Plus Button (Global FAB) */}
      <button
        onClick={() => {
          import('../../store/quickTaskModalStore').then(({ useQuickTaskModalStore }) => {
            useQuickTaskModalStore.getState().open()
          })
        }}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-apple-lg transition-transform duration-300 hover:scale-105 active:scale-95 sm:hidden"
        aria-label="Neue Aufgabe"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
      <QuickTaskModal />
      <AppUpdater />
    </ErrorBoundary>
  )
}
