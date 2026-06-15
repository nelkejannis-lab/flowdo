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
import { de, enUS } from 'date-fns/locale'
import i18n from '../i18n'

function currentLocale() {
  return i18n.language === 'en' ? enUS : de
}

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
  return format(date, 'd. MMM', { locale: currentLocale() })
}

export function formatFriendlyDateTime(iso?: string): string {
  if (!iso) return ''
  const date = parseISO(iso)
  return format(date, 'd. MMM yyyy, HH:mm', { locale: currentLocale() })
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

export const dateGroupOrder = ['Überfällig', 'Heute', 'Heute Abend', 'Morgen', 'Diese Woche', 'Später', 'Ohne Datum']

const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag']

export interface ParsedDate {
  date: string
  cleanedText: string
}

/** Erkennt einfache deutsche Datumsangaben in einem Text und entfernt sie. */
export function parseNaturalDate(text: string): ParsedDate | null {
  const lower = text.toLowerCase()
  const today = startOfDay(new Date())

  const tryMatch = (regex: RegExp, resolve: (match: RegExpMatchArray) => Date): ParsedDate | null => {
    const match = lower.match(regex)
    if (!match) return null
    const date = resolve(match)
    const before = text.slice(0, match.index).trim()
    const after = text.slice((match.index ?? 0) + match[0].length).trim()
    const cleanedText = [before, after].filter(Boolean).join(' ')
    return { date: toISODate(date), cleanedText }
  }

  return (
    tryMatch(/\bübermorgen\b/, () => addDaysTo(today, 2)) ??
    tryMatch(/\bmorgen\b/, () => addDaysTo(today, 1)) ??
    tryMatch(/\bheute\b/, () => today) ??
    tryMatch(/\bin (\d+) tagen\b/, (m) => addDaysTo(today, parseInt(m[1], 10))) ??
    tryMatch(/\bnächste woche\b/, () => addDaysTo(today, 7)) ??
    tryMatch(new RegExp(`\\b(?:nächsten |nächste |am )?(${WEEKDAYS.join('|')})\\b`), (m) =>
      nextWeekday(today, WEEKDAYS.indexOf(m[1]))
    ) ??
    null
  )
}

function addDaysTo(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function nextWeekday(from: Date, targetDay: number): Date {
  const currentDay = from.getDay()
  let diff = targetDay - currentDay
  if (diff <= 0) diff += 7
  return addDaysTo(from, diff)
}

export { startOfDay }
