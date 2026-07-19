/** Minutes from midnight. */
export type MinuteRange = { start: number; end: number }

export type PackableTask = {
  id: string
  title: string
  estimatedMinutes: number
  projectId?: string | null
  projectName?: string
}

export type PackedPlacement = PackableTask & {
  startMin: number
  endMin: number
  startTime: string
  endTime: string
}

export type PackResult = {
  placements: PackedPlacement[]
  /** Tasks that did not fit into remaining free slots. */
  overflow: PackableTask[]
}

export function parseHHMM(value: string): number | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function formatHHMM(totalMin: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(totalMin)))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Merge overlapping/adjacent busy ranges. */
export function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  if (ranges.length === 0) return []
  const sorted = [...ranges]
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start)
  const out: MinuteRange[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]
    const last = out[out.length - 1]
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end)
    } else {
      out.push({ ...cur })
    }
  }
  return out
}

/** Free gaps inside work window after subtracting busy ranges. */
export function freeSlots(work: MinuteRange, busy: MinuteRange[]): MinuteRange[] {
  const merged = mergeRanges(
    busy
      .map((b) => ({
        start: Math.max(work.start, b.start),
        end: Math.min(work.end, b.end),
      }))
      .filter((b) => b.end > b.start),
  )
  const gaps: MinuteRange[] = []
  let cursor = work.start
  for (const b of merged) {
    if (b.start > cursor) gaps.push({ start: cursor, end: b.start })
    cursor = Math.max(cursor, b.end)
  }
  if (cursor < work.end) gaps.push({ start: cursor, end: work.end })
  return gaps
}

/**
 * Pack tasks in priority order into free slots (earliest fit).
 * Does not split a task across gaps.
 */
export function packTasksIntoFreeSlots(
  tasks: PackableTask[],
  work: MinuteRange,
  busy: MinuteRange[],
  options?: { bufferMin?: number },
): PackResult {
  const buffer = Math.max(0, options?.bufferMin ?? 0)
  const gaps = freeSlots(work, busy).map((g) => ({ ...g }))
  const placements: PackedPlacement[] = []
  const overflow: PackableTask[] = []

  for (const task of tasks) {
    const duration = Math.max(5, Math.round(task.estimatedMinutes))
    let placed = false
    for (const gap of gaps) {
      const need = duration + buffer
      if (gap.end - gap.start < need) continue
      const startMin = gap.start
      const endMin = startMin + duration
      placements.push({
        ...task,
        estimatedMinutes: duration,
        startMin,
        endMin,
        startTime: formatHHMM(startMin),
        endTime: formatHHMM(endMin),
      })
      gap.start = endMin + buffer
      placed = true
      break
    }
    if (!placed) overflow.push({ ...task, estimatedMinutes: duration })
  }

  return { placements, overflow }
}
