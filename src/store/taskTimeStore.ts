import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { createId } from '../utils/id'

export interface TaskTimeEntry {
  id: string
  taskId?: string
  boardId: string
  userId: string
  minutes: number
  date: string
  note?: string
  createdAt: string
}

interface TaskTimeState {
  entries: TaskTimeEntry[]
  fetchByBoard: (boardId: string) => Promise<void>
  addEntry: (input: Omit<TaskTimeEntry, 'id' | 'createdAt'>) => Promise<void>
  getBoardSummary: (boardId: string, taskIds: string[]) => { totalMinutes: number; byTask: Record<string, number>; completionPct: number }
}

async function syncEntry(entry: TaskTimeEntry) {
  if (!isSupabaseConfigured) return
  await supabase.from('task_time_entries').upsert({
    id: entry.id,
    task_id: entry.taskId ?? null,
    board_id: entry.boardId,
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

      addEntry: async (input) => {
        const entry: TaskTimeEntry = { ...input, id: createId(), createdAt: new Date().toISOString() }
        set((s) => ({ entries: [entry, ...s.entries] }))
        await syncEntry(entry)
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
    }),
    { name: 'flowdo-task-time' }
  )
)
