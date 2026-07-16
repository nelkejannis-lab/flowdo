import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { createId } from '../utils/id'

export interface TaskTimeEntry {
  id: string
  taskId?: string
  boardId?: string
  ownerId?: string
  userId: string
  minutes: number
  date: string
  note?: string
  createdAt: string
}

interface TaskTimeState {
  entries: TaskTimeEntry[]
  fetchByBoard: (boardId: string) => Promise<void>
  fetchForUser: () => Promise<void>
  addEntry: (input: Omit<TaskTimeEntry, 'id' | 'createdAt'>) => Promise<void>
  updateEntry: (id: string, updates: Partial<Pick<TaskTimeEntry, 'minutes' | 'date' | 'taskId' | 'note'>>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  getBoardSummary: (boardId: string, taskIds: string[]) => { totalMinutes: number; byTask: Record<string, number>; completionPct: number }
  getTaskMinutes: (taskId: string) => number
  getEstimateComparison: (tasks: { id: string; estimatedMinutes?: number }[]) => { estimated: number; actual: number }
}

async function syncEntry(entry: TaskTimeEntry) {
  if (!isSupabaseConfigured) return
  await supabase.from('task_time_entries').upsert({
    id: entry.id,
    task_id: entry.taskId ?? null,
    board_id: entry.boardId ?? null,
    owner_id: entry.ownerId ?? null,
    user_id: entry.userId,
    minutes: entry.minutes,
    date: entry.date,
    note: entry.note ?? null,
  })
}

export const useTaskTimeStore = create<TaskTimeState>()(
  persist(
    (set, get) => ({
      entries: [],

      fetchByBoard: async (boardId) => {
        if (!isSupabaseConfigured) return
        const { data } = await supabase
          .from('task_time_entries')
          .select('id, task_id, board_id, user_id, minutes, date, note, created_at')
          .eq('board_id', boardId)
          .order('date', { ascending: false })
        const rows = (data ?? []) as { id: string; task_id: string | null; board_id: string; user_id: string; minutes: number; date: string; note: string | null; created_at: string }[]
        const fetched = rows.map((r) => ({
          id: r.id,
          taskId: r.task_id ?? undefined,
          boardId: r.board_id,
          ownerId: undefined,
          userId: r.user_id,
          minutes: r.minutes,
          date: r.date,
          note: r.note ?? undefined,
          createdAt: r.created_at,
        }))
        set((s) => ({
          entries: [...s.entries.filter((e) => e.boardId !== boardId), ...fetched],
        }))
      },

      fetchForUser: async () => {
        if (!isSupabaseConfigured) return
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (!userId) return
        const { data } = await supabase
          .from('task_time_entries')
          .select('id, task_id, board_id, owner_id, user_id, minutes, date, note, created_at')
          .eq('owner_id', userId)
          .order('date', { ascending: false })
        const rows = (data ?? []) as { id: string; task_id: string | null; board_id: string | null; owner_id: string | null; user_id: string; minutes: number; date: string; note: string | null; created_at: string }[]
        const fetched = rows.map((r) => ({
          id: r.id,
          taskId: r.task_id ?? undefined,
          boardId: r.board_id ?? undefined,
          ownerId: r.owner_id ?? undefined,
          userId: r.user_id,
          minutes: r.minutes,
          date: r.date,
          note: r.note ?? undefined,
          createdAt: r.created_at,
        }))
        set((s) => ({
          entries: [...s.entries.filter((e) => e.ownerId !== userId || e.boardId), ...fetched],
        }))
      },

      addEntry: async (input) => {
        const entry: TaskTimeEntry = { ...input, id: createId(), createdAt: new Date().toISOString() }
        set((s) => ({ entries: [entry, ...s.entries] }))
        await syncEntry(entry)
        if (input.taskId) {
          const { useAiDurationStore, taskDurationKey } = await import('./aiDurationStore')
          const { useProjectTasksStore } = await import('./projectTasksStore')
          const task = useProjectTasksStore.getState().myTasks.find((t) => t.id === input.taskId)
          if (task) {
            const key = taskDurationKey(task)
            useAiDurationStore.getState().recordActual(key, task.estimatedMinutes, input.minutes)
          }
        }
      },

      updateEntry: async (id, updates) => {
        let updated: TaskTimeEntry | undefined
        set((s) => ({
          entries: s.entries.map((e) => {
            if (e.id !== id) return e
            updated = { ...e, ...updates, taskId: updates.taskId === '' ? undefined : updates.taskId ?? e.taskId }
            return updated
          }),
        }))
        if (updated) await syncEntry(updated)
      },

      deleteEntry: async (id) => {
        set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
        if (isSupabaseConfigured) {
          await supabase.from('task_time_entries').delete().eq('id', id)
        }
      },

      getBoardSummary: (boardId, taskIds) => {
        const boardEntries = get().entries.filter((e) => e.boardId === boardId)
        const byTask: Record<string, number> = {}
        let totalMinutes = 0
        for (const e of boardEntries) {
          totalMinutes += e.minutes
          if (e.taskId) byTask[e.taskId] = (byTask[e.taskId] ?? 0) + e.minutes
        }
        const completionPct = taskIds.length === 0 ? 0 : Math.round((Object.keys(byTask).length / taskIds.length) * 100)
        return { totalMinutes, byTask, completionPct }
      },

      getTaskMinutes: (taskId) =>
        get().entries.filter((e) => e.taskId === taskId).reduce((sum, e) => sum + e.minutes, 0),

      getEstimateComparison: (tasks) => {
        let estimated = 0
        let actual = 0
        for (const t of tasks) {
          if (t.estimatedMinutes) estimated += t.estimatedMinutes
          actual += get().getTaskMinutes(t.id)
        }
        return { estimated, actual }
      },
    }),
    { name: 'flowdo-task-time', onRehydrateStorage: () => (state) => { if (state && !state.entries) state.entries = [] } }
  )
)
