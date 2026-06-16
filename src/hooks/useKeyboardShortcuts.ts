import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface ShortcutHandlers {
  onNewTask?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const navigate = useNavigate()

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handlers.onNewTask?.()
      }
      if (e.key === 't' || e.key === 'T') {
        e.preventDefault()
        navigate('/tasks/heute')
      }
      if (e.key === 'Escape') {
        // Esc is handled by Modal components individually — no global action needed
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [navigate, handlers])
}

export const SHORTCUTS = [
  { key: 'N', description: 'Neue Aufgabe erstellen / Create new task', scope: 'Global' },
  { key: 'T', description: 'Zu Heute navigieren / Go to Today', scope: 'Global' },
  { key: 'Esc', description: 'Dialog schließen / Close dialog', scope: 'Global' },
] as const
