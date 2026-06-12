import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile } from './authStore'
import type { Priority } from '../types'
import { useTasksStore } from './tasksStore'

interface SharedTaskRow {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: Priority
  tags: string[]
}

export interface IncomingShare {
  id: string
  suggestedPriority: Priority | null
  task: SharedTaskRow
  fromUser: Profile
}

interface TaskShareRow {
  id: string
  suggested_priority: Priority | null
  task: SharedTaskRow | SharedTaskRow[]
  from_user: Profile | Profile[]
}

interface NewSharedTaskInput {
  title: string
  description?: string
  dueDate?: string
  priority: Priority
  tags: string[]
  urgent: boolean
  important: boolean
}

interface TaskSharesState {
  incoming: IncomingShare[]
  loading: boolean
  error: string | null
  fetchIncoming: () => Promise<void>
  sendTask: (toUserId: string, input: NewSharedTaskInput) => Promise<string | null>
  acceptShare: (shareId: string) => Promise<void>
  declineShare: (shareId: string) => Promise<void>
}

function single<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value
}

export const useTaskSharesStore = create<TaskSharesState>()((set, get) => ({
  incoming: [],
  loading: false,
  error: null,

  fetchIncoming: async () => {
    set({ loading: true, error: null })
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      set({ loading: false })
      return
    }

    const { data, error } = await supabase
      .from('task_shares')
      .select('id, suggested_priority, task:tasks(id, title, description, due_date, priority, tags), from_user:profiles!task_shares_from_user_id_fkey(*)')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const rows = (data ?? []) as unknown as TaskShareRow[]
    const incoming: IncomingShare[] = rows
      .map((row) => ({
        id: row.id,
        suggestedPriority: row.suggested_priority,
        task: single(row.task),
        fromUser: single(row.from_user),
      }))
      .filter((row) => row.task && row.fromUser)

    set({ incoming, loading: false })
  },

  sendTask: async (toUserId, input) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return 'Nicht angemeldet'

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        owner_id: userId,
        assigned_to: toUserId,
        title: input.title,
        description: input.description ?? null,
        due_date: input.dueDate ?? null,
        priority: input.priority,
        tags: input.tags,
        urgent: input.urgent,
        important: input.important,
      })
      .select('id')
      .single()

    if (taskError) return taskError.message

    const { error: shareError } = await supabase.from('task_shares').insert({
      task_id: task.id,
      from_user_id: userId,
      to_user_id: toUserId,
      status: 'pending',
      suggested_priority: input.priority,
    })

    if (shareError) return shareError.message
    return null
  },

  acceptShare: async (shareId) => {
    const share = get().incoming.find((s) => s.id === shareId)
    if (!share) return

    useTasksStore.getState().addTask({
      title: share.task.title,
      description: share.task.description ?? undefined,
      dueDate: share.task.due_date ?? undefined,
      priority: share.suggestedPriority ?? share.task.priority,
      tags: share.task.tags ?? [],
    })

    await supabase.from('task_shares').update({ status: 'accepted' }).eq('id', shareId)
    set((state) => ({ incoming: state.incoming.filter((s) => s.id !== shareId) }))
  },

  declineShare: async (shareId) => {
    await supabase.from('task_shares').update({ status: 'declined' }).eq('id', shareId)
    set((state) => ({ incoming: state.incoming.filter((s) => s.id !== shareId) }))
  },
}))
