import { useEffect, useRef } from 'react'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import { toISODate } from '../utils/date'

// Fires a browser notification 10 minutes before each calendar entry's startTime
export function useCalendarReminders() {
  const entries = useCalendarEntriesStore((s) => s.entries)
  const firedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    function check() {
      const now = new Date()
      const today = toISODate(now)
      const nowMinutes = now.getHours() * 60 + now.getMinutes()

      for (const entry of entries) {
        if (entry.date !== today || !entry.startTime) continue
        const [h, m] = entry.startTime.split(':').map(Number)
        const startMinutes = h * 60 + (m ?? 0)
        const minutesUntil = startMinutes - nowMinutes

        // Notify at exactly 10 minutes before (within the current 1-minute tick)
        if (minutesUntil > 0 && minutesUntil <= 10) {
          const key = `${entry.id}-${today}-10min`
          if (!firedRef.current.has(key)) {
            firedRef.current.add(key)
            try {
              new Notification(`⏰ ${entry.title}`, {
                body: `Beginnt um ${entry.startTime} Uhr (in ${minutesUntil} Min.)`,
              })
            } catch {}
          }
        }

        // Also notify at start time
        if (minutesUntil <= 0 && minutesUntil > -1) {
          const key = `${entry.id}-${today}-now`
          if (!firedRef.current.has(key)) {
            firedRef.current.add(key)
            try {
              new Notification(`📅 ${entry.title}`, {
                body: `Beginnt jetzt (${entry.startTime} Uhr)`,
              })
            } catch {}
          }
        }
      }
    }

    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [entries])
}
