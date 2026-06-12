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
