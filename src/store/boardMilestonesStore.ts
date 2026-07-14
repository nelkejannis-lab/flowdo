import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { createId } from '../utils/id'
import type { BoardMilestone } from '../types'

interface BoardMilestonesState {
  milestones: BoardMilestone[]
  fetchByBoard: (boardId: string) => Promise<void>
  addMilestone: (boardId: string, title: string, dueDate: string) => Promise<void>
  toggleMilestone: (id: string) => Promise<void>
  deleteMilestone: (id: string) => Promise<void>
}

export const useBoardMilestonesStore = create<BoardMilestonesState>()((set, get) => ({
  milestones: [],

  fetchByBoard: async (boardId) => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase
      .from('board_milestones')
      .select('id, board_id, title, due_date, completed, created_at')
      .eq('board_id', boardId)
      .order('due_date', { ascending: true })
    const rows = (data ?? []) as { id: string; board_id: string; title: string; due_date: string; completed: boolean; created_at: string }[]
    const fetched = rows.map((r) => ({
      id: r.id,
      boardId: r.board_id,
      title: r.title,
      dueDate: r.due_date,
      completed: r.completed,
      createdAt: r.created_at,
    }))
    set((s) => ({
      milestones: [...s.milestones.filter((m) => m.boardId !== boardId), ...fetched],
    }))
  },

  addMilestone: async (boardId, title, dueDate) => {
    const milestone: BoardMilestone = {
      id: createId(),
      boardId,
      title,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ milestones: [...s.milestones, milestone] }))
    if (isSupabaseConfigured) {
      await supabase.from('board_milestones').insert({
        id: milestone.id,
        board_id: boardId,
        title,
        due_date: dueDate,
      })
    }
  },

  toggleMilestone: async (id) => {
    const m = get().milestones.find((x) => x.id === id)
    if (!m) return
    const completed = !m.completed
    set((s) => ({
      milestones: s.milestones.map((x) => (x.id === id ? { ...x, completed } : x)),
    }))
    if (isSupabaseConfigured) {
      await supabase.from('board_milestones').update({ completed }).eq('id', id)
    }
  },

  deleteMilestone: async (id) => {
    set((s) => ({ milestones: s.milestones.filter((m) => m.id !== id) }))
    if (isSupabaseConfigured) {
      await supabase.from('board_milestones').delete().eq('id', id)
    }
  },
}))
