import { describe, expect, it } from 'vitest'
import { computeDayReadiness, computeFocusStreak, computeWeeklyInsight } from '../lib/dayReadiness'
import type { ReadinessTask } from '../lib/dayReadiness'
import { format, subDays } from 'date-fns'

function task(partial: Partial<ReadinessTask> & Pick<ReadinessTask, 'id' | 'title'>): ReadinessTask {
  return {
    completed: false,
    urgent: false,
    important: false,
    priority: 'medium',
    ...partial,
  }
}

describe('computeDayReadiness', () => {
  it('scores higher when calm with work status', () => {
    const result = computeDayReadiness({
      tasks: [task({ id: '1', title: 'Light', dueDate: format(new Date(), 'yyyy-MM-dd') })],
      capacityPercent: 45,
      meetingMinutes: 30,
      targetMinutes: 480,
      hasWorkStatus: true,
      isWorkRunning: false,
      openTodayCount: 1,
      nextEventTitle: null,
    })
    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(['sharp', 'ready']).toContain(result.band)
  })

  it('penalizes overdue Q1 load', () => {
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const result = computeDayReadiness({
      tasks: [
        task({ id: 'a', title: 'A', urgent: true, important: true, dueDate: yesterday }),
        task({ id: 'b', title: 'B', urgent: true, important: true, dueDate: yesterday }),
        task({ id: 'c', title: 'C', urgent: true, important: true, dueDate: yesterday }),
      ],
      capacityPercent: 95,
      meetingMinutes: 180,
      targetMinutes: 480,
      hasWorkStatus: false,
      isWorkRunning: false,
      openTodayCount: 3,
    })
    expect(result.score).toBeLessThan(50)
    expect(result.overdueCount).toBe(3)
    expect(result.whyKey).toBe('overdue')
  })
})

describe('computeFocusStreak', () => {
  it('counts consecutive focus completions', () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const y = format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const tasks = [
      task({ id: '1', title: 'T', completed: true, completedAt: today, urgent: true, important: true }),
      task({ id: '2', title: 'Y', completed: true, completedAt: y, important: true }),
    ]
    expect(computeFocusStreak(tasks)).toBeGreaterThanOrEqual(2)
  })
})

describe('computeWeeklyInsight', () => {
  it('returns progress and wins', () => {
    const today = format(new Date(), 'yyyy-MM-dd')
    const insight = computeWeeklyInsight(
      [
        task({ id: '1', title: 'Win', completed: true, completedAt: today, urgent: true, important: true }),
        task({ id: '2', title: 'Open', dueDate: today }),
      ],
      [{ iso: today, label: 'Thursday', total: 2 }],
    )
    expect(insight.completedCount).toBe(1)
    expect(insight.completedFocusCount).toBe(1)
    expect(insight.winTitles).toContain('Win')
  })
})
