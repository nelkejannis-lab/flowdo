import { describe, expect, it } from 'vitest'
import { todayISO, toISODate } from './date'

describe('date utils', () => {
  it('todayISO returns yyyy-MM-dd format', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('toISODate formats dates', () => {
    expect(toISODate(new Date('2026-07-12T15:30:00'))).toBe('2026-07-12')
  })
})
