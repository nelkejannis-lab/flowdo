import { describe, expect, it } from 'vitest'
import { freeSlots, mergeRanges, packTasksIntoFreeSlots } from './daySlotPacker'

describe('daySlotPacker', () => {
  it('merges overlapping busy ranges', () => {
    expect(mergeRanges([
      { start: 60, end: 120 },
      { start: 90, end: 150 },
      { start: 200, end: 220 },
    ])).toEqual([
      { start: 60, end: 150 },
      { start: 200, end: 220 },
    ])
  })

  it('computes free slots inside work window', () => {
    const gaps = freeSlots(
      { start: 9 * 60, end: 17 * 60 },
      [
        { start: 10 * 60, end: 11 * 60 },
        { start: 13 * 60, end: 14 * 60 },
      ],
    )
    expect(gaps).toEqual([
      { start: 9 * 60, end: 10 * 60 },
      { start: 11 * 60, end: 13 * 60 },
      { start: 14 * 60, end: 17 * 60 },
    ])
  })

  it('packs tasks in priority order into earliest free slots', () => {
    const result = packTasksIntoFreeSlots(
      [
        { id: 'a', title: 'A', estimatedMinutes: 45 },
        { id: 'b', title: 'B', estimatedMinutes: 30 },
        { id: 'c', title: 'C', estimatedMinutes: 120 },
      ],
      { start: 9 * 60, end: 17 * 60 },
      [{ start: 10 * 60, end: 11 * 60 }],
      { bufferMin: 0 },
    )
    // A fills 09:00–09:45; remaining 15m before 10:00 meeting cannot fit B (30m) → B at 11:00
    expect(result.placements.map((p) => p.id)).toEqual(['a', 'b', 'c'])
    expect(result.placements[0].startTime).toBe('09:00')
    expect(result.placements[0].endTime).toBe('09:45')
    expect(result.placements[1].startTime).toBe('11:00')
    expect(result.placements[2].startTime).toBe('11:30')
    expect(result.overflow).toEqual([])
  })

  it('puts oversized tasks into overflow', () => {
    const result = packTasksIntoFreeSlots(
      [{ id: 'big', title: 'Big', estimatedMinutes: 200 }],
      { start: 9 * 60, end: 12 * 60 },
      [{ start: 9 * 60, end: 11 * 60 }],
    )
    expect(result.placements).toEqual([])
    expect(result.overflow.map((o) => o.id)).toEqual(['big'])
  })
})
