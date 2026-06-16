import type { CalendarEntry, CalendarEntryInvitee } from '../types'

function entryKey(e: CalendarEntry): string {
  return `${e.title.trim().toLowerCase()}|${e.date}|${e.startTime ?? ''}|${e.color}`
}

export function mergeCalendarEntries(entries: CalendarEntry[]): CalendarEntry[] {
  const groups = new Map<string, CalendarEntry[]>()
  for (const entry of entries) {
    const key = entryKey(entry)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(entry)
  }

  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0]

    const base = group[0]
    const allPeople = new Map<string, CalendarEntryInvitee>()

    for (const e of group) {
      if (e.owner) allPeople.set(e.owner.id, e.owner)
      for (const inv of e.invitees) allPeople.set(inv.id, inv)
    }

    return {
      ...base,
      invitees: [...allPeople.values()],
    }
  })
}
