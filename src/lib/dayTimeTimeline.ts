import type { WorkDayEntry, WorkTimePunch } from '../types'
import type { TaskTimeEntry } from '../store/taskTimeStore'
import { formatPunchTime, netMinutes, punchesForDay } from '../utils/worktime'

export type DayTimelineKind = 'work_in' | 'work_out' | 'task' | 'task_block'

export interface DayTimelineItem {
  id: string
  kind: DayTimelineKind
  /** HH:MM for sorting when available */
  sortKey: string
  timeLabel: string
  title: string
  minutes?: number
  note?: string
}

export function buildDayTimeline(opts: {
  dateISO: string
  punches: WorkTimePunch[]
  workEntry?: WorkDayEntry
  taskEntries: TaskTimeEntry[]
  taskTitles: Record<string, string>
}): DayTimelineItem[] {
  const { dateISO, punches, workEntry, taskEntries, taskTitles } = opts
  const items: DayTimelineItem[] = []

  const dayPunches = punchesForDay(punches, dateISO)
  for (const p of dayPunches) {
    const time = formatPunchTime(p.punchedAt)
    items.push({
      id: `punch-${p.id}`,
      kind: p.kind === 'in' ? 'work_in' : 'work_out',
      sortKey: time,
      timeLabel: time,
      title: p.kind === 'in' ? 'Eingestempelt' : 'Ausgestempelt',
    })
  }

  if (dayPunches.length === 0 && workEntry?.startTime) {
    items.push({
      id: `range-start-${dateISO}`,
      kind: 'work_in',
      sortKey: workEntry.startTime,
      timeLabel: workEntry.startTime,
      title: 'Arbeitsbeginn',
    })
    if (workEntry.endTime) {
      items.push({
        id: `range-end-${dateISO}`,
        kind: 'work_out',
        sortKey: workEntry.endTime,
        timeLabel: workEntry.endTime,
        title: 'Arbeitsende',
        minutes: netMinutes(workEntry),
      })
    }
  }

  for (const e of taskEntries.filter((x) => x.date === dateISO)) {
    const title = (e.taskId && taskTitles[e.taskId]) || e.note || 'Aufgabenzeit'
    items.push({
      id: `task-${e.id}`,
      kind: 'task',
      sortKey: '12:00',
      timeLabel: `${e.minutes} Min`,
      title,
      minutes: e.minutes,
      note: e.note,
    })
  }

  items.sort((a, b) => {
    const kindBias = (k: DayTimelineKind) =>
      k === 'work_in' ? 0 : k === 'task' || k === 'task_block' ? 1 : 2
    return a.sortKey.localeCompare(b.sortKey) || kindBias(a.kind) - kindBias(b.kind)
  })

  return items
}
