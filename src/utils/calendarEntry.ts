import type { CalendarEntryType } from '../types'

export const entryTypeIcon: Record<CalendarEntryType, string> = {
  termin: '🗓️',
  reise: '✈️',
  urlaub: '🌴',
}

export const entryTypeLabel: Record<CalendarEntryType, string> = {
  termin: 'Termin',
  reise: 'Außerhaus',
  urlaub: 'Urlaub',
}

/** Virtual recurring occurrences use ids like `{uuid}_recur_{n}`. */
export function parseCalendarEntryId(id: string): { dbId: string; isVirtual: boolean } {
  const marker = '_recur_'
  const idx = id.indexOf(marker)
  if (idx === -1) return { dbId: id, isVirtual: false }
  return { dbId: id.slice(0, idx), isVirtual: true }
}

export function occurrenceKey(dbId: string, date: string): string {
  return `${dbId}:${date}`
}
