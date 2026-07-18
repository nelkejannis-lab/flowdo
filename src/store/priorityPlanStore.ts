import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format, startOfWeek } from 'date-fns'
import { todayISO } from '../utils/date'

function weekKey(d = new Date()): string {
  return format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

interface PriorityPlanState {
  /** date ISO → ordered task ids for that day */
  dayOrders: Record<string, string[]>
  /** Monday ISO → ordered task ids for that week */
  weekOrders: Record<string, string[]>
  /** date ISO when day priority was confirmed */
  dayConfirmed: Record<string, boolean>
  /** Monday ISO when week priority was confirmed */
  weekConfirmed: Record<string, boolean>
  /** Tomorrow top-3 proposed at evening close */
  tomorrowTop3: Record<string, string[]>
  setDayOrder: (date: string, ids: string[]) => void
  setWeekOrder: (weekStart: string, ids: string[]) => void
  confirmDay: (date: string) => void
  confirmWeek: (weekStart: string) => void
  setTomorrowTop3: (date: string, ids: string[]) => void
  applyOrder: <T extends { id: string }>(items: T[], order: string[] | undefined) => T[]
  todayKey: () => string
  currentWeekKey: () => string
}

export const usePriorityPlanStore = create<PriorityPlanState>()(
  persist(
    (set, get) => ({
      dayOrders: {},
      weekOrders: {},
      dayConfirmed: {},
      weekConfirmed: {},
      tomorrowTop3: {},

      setDayOrder: (date, ids) =>
        set((s) => ({ dayOrders: { ...s.dayOrders, [date]: ids } })),

      setWeekOrder: (weekStart, ids) =>
        set((s) => ({ weekOrders: { ...s.weekOrders, [weekStart]: ids } })),

      confirmDay: (date) =>
        set((s) => ({ dayConfirmed: { ...s.dayConfirmed, [date]: true } })),

      confirmWeek: (weekStart) =>
        set((s) => ({ weekConfirmed: { ...s.weekConfirmed, [weekStart]: true } })),

      setTomorrowTop3: (date, ids) =>
        set((s) => ({ tomorrowTop3: { ...s.tomorrowTop3, [date]: ids } })),

      applyOrder: (items, order) => {
        if (!order?.length) return items
        const map = new Map(items.map((i) => [i.id, i]))
        const ordered: typeof items = []
        for (const id of order) {
          const hit = map.get(id)
          if (hit) {
            ordered.push(hit)
            map.delete(id)
          }
        }
        for (const rest of map.values()) ordered.push(rest)
        return ordered
      },

      todayKey: () => todayISO(),
      currentWeekKey: () => weekKey(),
    }),
    { name: 'novat-priority-plan' },
  ),
)

export { weekKey }
