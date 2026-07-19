import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface DayPlanItem {
  id: string
  title: string
  startTime: string | null
  endTime: string | null
  projectId: string | null
}

interface DayPlanState {
  plans: Record<string, DayPlanItem[]>
  setItems: (date: string, items: DayPlanItem[]) => void
  appendItems: (date: string, items: DayPlanItem[]) => void
  addItem: (date: string, item: DayPlanItem) => void
  updateItem: (date: string, id: string, patch: Partial<DayPlanItem>) => void
  removeItem: (date: string, id: string) => void
}

function sortByStartTime(items: DayPlanItem[]): DayPlanItem[] {
  return [...items].sort((a, b) => (a.startTime ?? '99:99').localeCompare(b.startTime ?? '99:99'))
}

export const useDayPlanStore = create<DayPlanState>()(
  persist(
    (set) => ({
      plans: {},
      setItems: (date, items) =>
        set((s) => ({ plans: { ...s.plans, [date]: sortByStartTime(items) } })),
      appendItems: (date, items) =>
        set((s) => ({ plans: { ...s.plans, [date]: sortByStartTime([...(s.plans[date] ?? []), ...items]) } })),
      addItem: (date, item) =>
        set((s) => ({ plans: { ...s.plans, [date]: sortByStartTime([...(s.plans[date] ?? []), item]) } })),
      updateItem: (date, id, patch) =>
        set((s) => ({
          plans: {
            ...s.plans,
            [date]: sortByStartTime((s.plans[date] ?? []).map((it) => (it.id === id ? { ...it, ...patch } : it))),
          },
        })),
      removeItem: (date, id) =>
        set((s) => ({ plans: { ...s.plans, [date]: (s.plans[date] ?? []).filter((it) => it.id !== id) } })),
    }),
    { name: 'flowdo-dayplan' }
  )
)
