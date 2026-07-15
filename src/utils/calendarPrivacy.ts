import type { CalendarEntry } from '../types'

/** Whether a colleague's absence entry should be blurred in team views. */
export function shouldBlurColleagueEntry(
  entry: CalendarEntry,
  opts: {
    blurVacation: boolean
    blurOutOfOffice: boolean
    showColleagueAbsences: boolean
    currentUserId?: string
  }
): boolean {
  if (opts.showColleagueAbsences) return false
  if (entry.ownerId === opts.currentUserId) return false
  if (entry.type === 'urlaub' && opts.blurVacation) return true
  if (entry.type === 'reise' && opts.blurOutOfOffice) return true
  return false
}

export function blurredEntryLabel(type: CalendarEntry['type'], lang: 'de' | 'en'): string {
  if (type === 'urlaub') return lang === 'de' ? 'Abwesend' : 'Away'
  return lang === 'de' ? 'Außer Haus' : 'Out of office'
}
