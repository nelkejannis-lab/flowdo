import { eachDayOfInterval, parseISO } from 'date-fns'
import type { CalendarEntry, CalendarEvent } from '../types'
import { toISODate } from './date'

export function eachEventDate(event: CalendarEvent): string[] {
  if (!event.endDate || event.endDate <= event.date) return [event.date]
  return eachDayOfInterval({ start: parseISO(event.date), end: parseISO(event.endDate) }).map(toISODate)
}

export function isMultiDayEvent(event: CalendarEvent): boolean {
  return !!event.endDate && event.endDate > event.date
}

export function eachEntryDate(entry: CalendarEntry): string[] {
  if (!entry.endDate || entry.endDate <= entry.date) return [entry.date]
  return eachDayOfInterval({ start: parseISO(entry.date), end: parseISO(entry.endDate) }).map(toISODate)
}

export function isMultiDayEntry(entry: CalendarEntry): boolean {
  return !!entry.endDate && entry.endDate > entry.date
}
