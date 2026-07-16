import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export interface ShortcutHandlers {
  onNewTask?: () => void
  onNewTermin?: () => void
  onCalendar?: () => void
  onClockIn?: () => void
  onPause?: () => void
  onSearch?: () => void
  onBrain?: () => void
  onShowHelp?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const navigate = useNavigate()

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement).isContentEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (key === 'n') { e.preventDefault(); handlers.onNewTask?.() }
      if (key === 'e') { e.preventDefault(); handlers.onNewTermin?.() }
      if (key === 't') { e.preventDefault(); navigate('/tasks/heute') }
      if (key === 'c') { e.preventDefault(); handlers.onCalendar?.() ?? navigate('/calendar') }
      if (key === 'k') { e.preventDefault(); handlers.onClockIn?.() }
      if (key === 'p') { e.preventDefault(); handlers.onPause?.() }
      if (key === '/') { e.preventDefault(); handlers.onSearch?.() }
      if (key === 'g') { e.preventDefault(); handlers.onBrain?.() ?? navigate('/creative-board') }
      if (key === '?') { e.preventDefault(); handlers.onShowHelp?.() }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [navigate, handlers])
}

export const SHORTCUTS = [
  { key: 'N', description: 'Neue Aufgabe', descriptionDe: 'Neue Aufgabe', descriptionEn: 'New task', scope: 'Global' },
  { key: 'E', description: 'Neuer Termin', descriptionDe: 'Neuer Termin', descriptionEn: 'New appointment', scope: 'Global' },
  { key: 'T', description: 'Heute-Ansicht', descriptionDe: 'Heute-Ansicht', descriptionEn: 'Go to Today', scope: 'Global' },
  { key: 'C', description: 'Kalender', descriptionDe: 'Kalender', descriptionEn: 'Calendar', scope: 'Global' },
  { key: 'K', description: 'Einstempeln', descriptionDe: 'Einstempeln', descriptionEn: 'Clock in', scope: 'Global' },
  { key: 'P', description: 'Pause', descriptionDe: 'Pause', descriptionEn: 'Break', scope: 'Global' },
  { key: '/', description: 'Suche fokussieren', descriptionDe: 'Suche fokussieren', descriptionEn: 'Focus search', scope: 'Global' },
  { key: 'G', description: 'Creative Board', descriptionDe: 'Creative Board', descriptionEn: 'Creative Board', scope: 'Global' },
  { key: '?', description: 'Shortcuts anzeigen', descriptionDe: 'Shortcuts anzeigen', descriptionEn: 'Show shortcuts', scope: 'Global' },
  { key: 'Esc', description: 'Dialog schließen', descriptionDe: 'Dialog schließen', descriptionEn: 'Close dialog', scope: 'Global' },
] as const
