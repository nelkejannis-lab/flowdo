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

export default function Layout() {
  const { t } = useTranslation('layout')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      <OfflineBanner />
      <div className="flex h-screen w-full overflow-hidden">
        <GlobalSearch />
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100/80 bg-white/80 px-4 py-3 backdrop-blur-apple dark:border-white/5 dark:bg-racing-900/80 sm:hidden" style={{ paddingTop: 'max(12px, calc(12px + env(safe-area-inset-top)))', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' }}>
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
    </>
  )
}
