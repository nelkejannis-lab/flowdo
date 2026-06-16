import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div className="flex items-center gap-2 bg-orange-500 px-4 py-2 text-sm font-medium text-white">
      <WifiOff size={16} />
      <span>Keine Internetverbindung – Änderungen werden lokal gespeichert / No internet connection – changes saved locally</span>
    </div>
  )
}
