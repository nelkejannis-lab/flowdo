import {
  format,
  isToday,
  isTomorrow,
  isYesterday,
  isThisWeek,
  isPast,
  parseISO,
  startOfDay,
} from 'date-fns'
import { de } from 'date-fns/locale'

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function formatFriendlyDate(iso?: string): string {
  if (!iso) return ''
  const date = parseISO(iso)
  if (isToday(date)) return 'Heute'
  if (isTomorrow(date)) return 'Morgen'
  if (isYesterday(date)) return 'Gestern'
  return format(date, 'd. MMM', { locale: de })
}

export function formatFriendlyDateTime(iso?: string): string {
  if (!iso) return ''
  const date = parseISO(iso)
  return format(date, 'd. MMM yyyy, HH:mm', { locale: de })
}

export function isOverdue(iso?: string): boolean {
  if (!iso) return false
  const date = parseISO(iso)
  return isPast(date) && !isToday(date)
}

export function isDueToday(iso?: string): boolean {
  if (!iso) return false
  return isToday(parseISO(iso))
}

export function isDueThisWeek(iso?: string): boolean {
  if (!iso) return false
  const date = parseISO(iso)
  return isThisWeek(date, { weekStartsOn: 1 }) && !isToday(date) && !isPast(date)
}

export function dateGroupLabel(iso?: string): string {
  if (!iso) return 'Ohne Datum'
  const date = parseISO(iso)
  if (isOverdue(iso)) return 'Überfällig'
  if (isToday(date)) return 'Heute'
  if (isTomorrow(date)) return 'Morgen'
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'Diese Woche'
  return 'Später'
}

export const dateGroupOrder = ['Überfällig', 'Heute', 'Morgen', 'Diese Woche', 'Später', 'Ohne Datum']

export { startOfDay }
