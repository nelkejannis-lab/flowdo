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
    tryMatch(/\b(?:für\s+|am\s+)?übermorgen\b/, () => addDaysTo(today, 2)) ??
    tryMatch(/\b(?:für\s+|am\s+)?morgen\b/, () => addDaysTo(today, 1)) ??
    tryMatch(/\b(?:für\s+|am\s+)?heute\b/, () => today) ??
    tryMatch(/\b(?:in\s+)?(\d+)\s+tagen?\b/, (m) => addDaysTo(today, parseInt(m[1], 10))) ??
    tryMatch(/\b(?:für\s+|am\s+)?nächste\s+woche\b/, () => addDaysTo(today, 7)) ??
    tryMatch(new RegExp(`\\b(?:nächsten |nächste |am |für )?(${WEEKDAYS.join('|')})\\b`), (m) =>
      nextWeekday(today, WEEKDAYS.indexOf(m[1]))
    ) ??
    null
  )
}

export interface ParsedTaskInput {
  title: string
  dueDate?: string
  projectId?: string
  priority: 'low' | 'medium' | 'high'
  urgent: boolean
  important: boolean
}

export function parseTaskInput(text: string, boards: { id: string; title: string }[]): ParsedTaskInput {
  let cleaned = text;

  // 1. Parse Date first so that weekday and date words (e.g. "heute", "morgen") are removed before filler matching
  const parsedDate = parseNaturalDate(cleaned);
  let dueDate: string | undefined = undefined;
  if (parsedDate) {
    dueDate = parsedDate.date;
    cleaned = parsedDate.cleanedText;
  }

  // 2. Clean noise prefix e.g., "neue todo für", "neues todo", "neue aufgabe", "todo", "aufgabe", "task"
  const noiseRegex = /^(neue[s]?\s+(?:todo|aufgabe|task|arbeit)|todo|aufgabe|task)\s*(?:für\s+|am\s+|an\s+)?/i;
  cleaned = cleaned.replace(noiseRegex, '').trim();

  // 3. Clean German filler prefixes
  const fillersRegex = /^(ich\s+muss\s+noch|ich\s+muss|muss\s+noch|muss|ich\s+möchte\s+noch|ich\s+möchte|möchte\s+noch|möchte|ich\s+will|wir\s+müssen|wir\s+wollen|bitte\s+mal|bitte|vergiss\s+nicht|nicht\s+vergessen|erinnerung\s+an|erinnere\s+mich\s+an|denk\s+daran|denk\s+an|vergiss\s+nicht\s+zu|denk\s+daran\s+zu)\s+/i;
  cleaned = cleaned.replace(fillersRegex, '').trim();

  // 4. Clean leading "noch" if left over
  cleaned = cleaned.replace(/^noch\s+/i, '').trim();

  // 5. Clean leading articles/prepositions
  const leadingArticlesRegex = /^(das|die|den|der|ein|eine|einen|zum|zur|für|mit|an|am|von)\s+/i;
  cleaned = cleaned.replace(leadingArticlesRegex, '').trim();

  // 6. Parse Eisenhower quadrants or urgency/importance keywords
  let urgent = false;
  let important = false;

  const urgentImportantRegex = /\b(dringend\s+und\s+wichtig|wichtig\s+und\s+dringend)\b/i;
  const importantNotUrgentRegex = /\b(wichtig\s+(?:aber\s+)?nicht\s+dringend|wichtig\s+nicht\s+dringend)\b/i;
  const urgentNotImportantRegex = /\b(dringend\s+(?:aber\s+)?nicht\s+wichtig|dringend\s+nicht\s+wichtig)\b/i;
  const neitherRegex = /\b(nicht\s+dringend\s+und\s+nicht\s+wichtig|nicht\s+dringend\s+nicht\s+wichtig)\b/i;

  if (urgentImportantRegex.test(cleaned)) {
    urgent = true;
    important = true;
    cleaned = cleaned.replace(urgentImportantRegex, '').trim();
  } else if (importantNotUrgentRegex.test(cleaned)) {
    urgent = false;
    important = true;
    cleaned = cleaned.replace(importantNotUrgentRegex, '').trim();
  } else if (urgentNotImportantRegex.test(cleaned)) {
    urgent = true;
    important = false;
    cleaned = cleaned.replace(urgentNotImportantRegex, '').trim();
  } else if (neitherRegex.test(cleaned)) {
    urgent = false;
    important = false;
    cleaned = cleaned.replace(neitherRegex, '').trim();
  } else {
    // Check individual keywords
    const urgentRegex = /\bdringend\b/i;
    if (urgentRegex.test(cleaned)) {
      urgent = true;
      cleaned = cleaned.replace(urgentRegex, '').trim();
    }
    const importantRegex = /\bwichtig\b/i;
    if (importantRegex.test(cleaned)) {
      important = true;
      cleaned = cleaned.replace(importantRegex, '').trim();
    }
  }

  // 7. Parse Priority keywords
  let priority: 'low' | 'medium' | 'high' = 'medium';
  const highPriorityRegex = /\b(hohe\s+priorität|hohe\s+prio|prio\s+hoch|priorität\s+hoch|sehr\s+wichtig)\b/i;
  const lowPriorityRegex = /\b(niedrige\s+priorität|niedrige\s+prio|prio\s+niedrig|priorität\s+niedrig|nicht\s+wichtig|weniger\s+wichtig)\b/i;
  const mediumPriorityRegex = /\b(mittlere\s+priorität|mittlere\s+prio|prio\s+mittel|priorität\s+mittel|normal(e)?\s+prio)\b/i;

  if (highPriorityRegex.test(cleaned)) {
    priority = 'high';
    important = true; // high priority is also important
    cleaned = cleaned.replace(highPriorityRegex, '').trim();
  } else if (lowPriorityRegex.test(cleaned)) {
    priority = 'low';
    cleaned = cleaned.replace(lowPriorityRegex, '').trim();
  } else if (mediumPriorityRegex.test(cleaned)) {
    priority = 'medium';
    cleaned = cleaned.replace(mediumPriorityRegex, '').trim();
  }

  // 8. Parse Project/Board (sort boards by title length descending first)
  let projectId: string | undefined = undefined;
  const sortedBoards = [...boards].sort((a, b) => b.title.length - a.title.length);
  for (const board of sortedBoards) {
    const escaped = board.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const projectRegex = new RegExp(`\\bin\\s+${escaped}\\b`, 'i');
    if (projectRegex.test(cleaned)) {
      projectId = board.id;
      cleaned = cleaned.replace(projectRegex, '').trim();
      break;
    }
  }

  // Cleanup extra spaces or leftover leading/trailing conjunctions e.g., "für", "am", "in" if they are at start/end
  cleaned = cleaned
    .replace(/^(für|am|in|an)\s+/i, '')
    .replace(/\s+(für|am|in|an)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  // If the cleaning leaves us with nothing, fallback to original text
  if (!cleaned) {
    cleaned = text;
  }

  // Capitalize first letter of cleaned text
  cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  return {
    title: cleaned,
    dueDate,
    projectId,
    priority,
    urgent,
    important
  };
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

