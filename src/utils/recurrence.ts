import { addDays, addWeeks, addMonths, parseISO, format } from 'date-fns'
import type { CalendarEntry } from '../types'

// Expand a single entry with recurrence into all occurrences within [rangeStart, rangeEnd]
export function expandRecurringEntries(
  entries: CalendarEntry[],
  rangeStart: string,
  rangeEnd: string
): CalendarEntry[] {
  const result: CalendarEntry[] = []

  for (const entry of entries) {
    result.push(entry)

    if (!entry.recurrence) continue

    const baseDate = parseISO(entry.date)
    const end = parseISO(rangeEnd)
    let occurrence = 1
    let maxOccurrences = 60 // safety cap

    while (occurrence < maxOccurrences) {
      let nextDate: Date
      if (entry.recurrence === 'daily') {
        nextDate = addDays(baseDate, occurrence)
      } else if (entry.recurrence === 'weekly') {
        nextDate = addWeeks(baseDate, occurrence)
      } else if (entry.recurrence === 'monthly') {
        nextDate = addMonths(baseDate, occurrence)
      } else {
        break
      }

      if (nextDate > end) break

      const nextISO = format(nextDate, 'yyyy-MM-dd')
      if (nextISO >= rangeStart) {
        result.push({
          ...entry,
          id: `${entry.id}_recur_${occurrence}`,
          date: nextISO,
          endDate: undefined,
        })
      }
      occurrence++
    }
  }

  return result
}
