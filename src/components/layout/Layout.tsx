import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import Logo from './Logo'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3 dark:border-racing-800 sm:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:text-racing-100 dark:hover:bg-racing-800"
            aria-label="Menü öffnen"
          >
            <Menu size={20} />
          </button>
          <Logo size="sm" />
          <span className="text-base font-semibold">Mooncrew</span>
        </div>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
