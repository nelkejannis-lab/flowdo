import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format, startOfWeek } from 'date-fns'
import { todayISO } from '../utils/date'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'

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

function trimMap(map: Record<string, unknown>, keep = 21) {
  const keys = Object.keys(map).sort()
  if (keys.length <= keep) return map
  const drop = keys.slice(0, keys.length - keep)
  const next = { ...map }
  for (const k of drop) delete next[k]
  return next
}

function planPayload(state: PriorityPlanState) {
  return {
    dayOrders: trimMap(state.dayOrders) as Record<string, string[]>,
    weekOrders: trimMap(state.weekOrders, 12) as Record<string, string[]>,
    dayConfirmed: trimMap(state.dayConfirmed) as Record<string, boolean>,
    weekConfirmed: trimMap(state.weekConfirmed, 12) as Record<string, boolean>,
    tomorrowTop3: trimMap(state.tomorrowTop3) as Record<string, string[]>,
  }
}

let syncTimer: ReturnType<typeof setTimeout> | null = null

function syncPriorityPlanToProfile() {
  const auth = useAuthStore.getState()
  const userId = auth.user?.id
  if (!userId || !auth.profile) return
  const state = usePriorityPlanStore.getState()
  const priorityPlan = planPayload(state)
  const existing = (auth.profile.settings || {}) as Record<string, unknown>
  const prev = existing.priorityPlan
  if (prev && JSON.stringify(prev) === JSON.stringify(priorityPlan)) return
  const settings = { ...existing, priorityPlan }
  void supabase
    .from('profiles')
    .update({ settings })
    .eq('id', userId)
    .then(({ error }) => {
      if (!error && auth.profile) {
        useAuthStore.setState({
          profile: { ...auth.profile, settings },
        })
      }
    })
}

function scheduleSync() {
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    syncTimer = null
    syncPriorityPlanToProfile()
  }, 800)
}

export const usePriorityPlanStore = create<PriorityPlanState>()(
  persist(
    (set, get) => ({
      dayOrders: {},
      weekOrders: {},
      dayConfirmed: {},
      weekConfirmed: {},
      tomorrowTop3: {},

      setDayOrder: (date, ids) => {
        set((s) => ({ dayOrders: { ...s.dayOrders, [date]: ids } }))
        scheduleSync()
      },

      setWeekOrder: (weekStart, ids) => {
        set((s) => ({ weekOrders: { ...s.weekOrders, [weekStart]: ids } }))
        scheduleSync()
      },

      confirmDay: (date) => {
        set((s) => ({ dayConfirmed: { ...s.dayConfirmed, [date]: true } }))
        scheduleSync()
      },

      confirmWeek: (weekStart) => {
        set((s) => ({ weekConfirmed: { ...s.weekConfirmed, [weekStart]: true } }))
        scheduleSync()
      },

      setTomorrowTop3: (date, ids) => {
        set((s) => ({ tomorrowTop3: { ...s.tomorrowTop3, [date]: ids } }))
        scheduleSync()
      },

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
    {
      name: 'novat-priority-plan',
      onRehydrateStorage: () => (state) => {
        if (!state) return
        // Hydrate from profile if cloud has newer/empty-local merge
        const cloud = useAuthStore.getState().profile?.settings?.priorityPlan as
          | Partial<PriorityPlanState>
          | undefined
        if (!cloud) return
        if (!Object.keys(state.dayOrders || {}).length && cloud.dayOrders) {
          usePriorityPlanStore.setState({
            dayOrders: cloud.dayOrders || {},
            weekOrders: cloud.weekOrders || {},
            dayConfirmed: cloud.dayConfirmed || {},
            weekConfirmed: cloud.weekConfirmed || {},
            tomorrowTop3: cloud.tomorrowTop3 || {},
          })
        }
      },
    },
  ),
)

// When profile loads later, merge cloud priority plan if local is empty
let lastProfileId: string | null = null
useAuthStore.subscribe((auth) => {
  const profile = auth.profile
  if (!profile || profile.id === lastProfileId) return
  lastProfileId = profile.id
  const cloud = profile.settings?.priorityPlan as Partial<PriorityPlanState> | undefined
  if (!cloud) return
  const local = usePriorityPlanStore.getState()
  if (Object.keys(local.dayOrders).length || Object.keys(local.weekOrders).length) return
  if (!cloud.dayOrders && !cloud.weekOrders && !cloud.tomorrowTop3) return
  usePriorityPlanStore.setState({
    dayOrders: cloud.dayOrders || {},
    weekOrders: cloud.weekOrders || {},
    dayConfirmed: cloud.dayConfirmed || {},
    weekConfirmed: cloud.weekConfirmed || {},
    tomorrowTop3: cloud.tomorrowTop3 || {},
  })
})

export { weekKey }
