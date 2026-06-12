import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Priority, Subtask, Task } from '../types'

interface NewProjectTaskInput {
  title: string
  description?: string
  dueDate?: string
  priority?: Priority
  tags?: string[]
  urgent?: boolean
  important?: boolean
  boardId: string
  columnId?: string
  assignedTo?: string
}

interface ProjectTaskRow {
  id: string
  owner_id: string
  assigned_to: string | null
  title: string
  description: string | null
  due_date: string | null
  priority: Priority
  tags: string[]
  urgent: boolean
  important: boolean
  completed: boolean
  completed_at: string | null
  board_id: string | null
  column_id: string | null
  subtasks: Subtask[]
  created_at: string
  assignee: Task['assignee'] | Task['assignee'][] | null
}

function single<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value
}

function toTask(row: ProjectTaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    dueDate: row.due_date ?? undefined,
    priority: row.priority,
    tags: row.tags ?? [],
    urgent: row.urgent,
    important: row.important,
    completed: row.completed,
    completedAt: row.completed_at ?? undefined,
    boardId: row.board_id ?? undefined,
    columnId: row.column_id ?? undefined,
    ownerId: row.owner_id,
    assignedTo: row.assigned_to ?? undefined,
    assignee: row.assignee ? single(row.assignee) : undefined,
    subtasks: row.subtasks ?? [],
    createdAt: row.created_at,
  }
}

const SELECT = '*, assignee:profiles!tasks_assigned_to_fkey(id, username, display_name, avatar_color)'

interface ProjectTasksState {
  tasks: Task[]
  myTasks: Task[]
  loading: boolean
  error: string | null
  fetchTasks: (boardId: string) => Promise<void>
  fetchMyTasks: () => Promise<void>
  addTask: (input: NewProjectTaskInput) => Promise<{ id?: string; error?: string }>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  toggleTaskCompleted: (id: string) => Promise<void>
  addSubtask: (taskId: string, title: string) => Promise<void>
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>
  deleteSubtask: (taskId: string, subtaskId: string) => Promise<void>
  moveTaskToColumn: (taskId: string, boardId: string, columnId: string) => Promise<void>
}

export const useProjectTasksStore = create<ProjectTasksState>()((set, get) => ({
  tasks: [],
  myTasks: [],
  loading: false,
  error: null,

  fetchTasks: async (boardId) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('tasks')
      .select(SELECT)
      .eq('board_id', boardId)
      .order('created_at', { ascending: false })

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const tasks = ((data ?? []) as unknown as ProjectTaskRow[]).map(toTask)
    set({ tasks, loading: false })
  },

  fetchMyTasks: async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from('tasks')
      .select(SELECT)
      .not('board_id', 'is', null)
      .or(`owner_id.eq.${userId},assigned_to.eq.${userId}`)
      .order('due_date', { ascending: true })

    if (error) {
      set({ error: error.message })
      return
    }

    const myTasks = ((data ?? []) as unknown as ProjectTaskRow[]).map(toTask)
    set({ myTasks })
  },

  addTask: async (input) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return { error: 'Nicht angemeldet' }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        owner_id: userId,
        assigned_to: input.assignedTo ?? null,
        title: input.title,
        description: input.description ?? null,
        due_date: input.dueDate ?? null,
        priority: input.priority ?? 'medium',
        tags: input.tags ?? [],
        urgent: input.urgent ?? false,
        important: input.important ?? false,
        board_id: input.boardId,
        column_id: input.columnId ?? null,
      })
      .select('id')
      .single()

    if (error || !data) return { error: error?.message ?? 'Fehler beim Erstellen' }
    await Promise.all([get().fetchTasks(input.boardId), get().fetchMyTasks()])
    return { id: data.id }
  },

  updateTask: async (id, updates) => {
    const payload: Record<string, unknown> = {}
    if (updates.title !== undefined) payload.title = updates.title
    if (updates.description !== undefined) payload.description = updates.description ?? null
    if (updates.dueDate !== undefined) payload.due_date = updates.dueDate ?? null
    if (updates.priority !== undefined) payload.priority = updates.priority
    if (updates.tags !== undefined) payload.tags = updates.tags
    if (updates.urgent !== undefined) payload.urgent = updates.urgent
    if (updates.important !== undefined) payload.important = updates.important
    if (updates.completed !== undefined) payload.completed = updates.completed
    if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt ?? null
    if (updates.columnId !== undefined) payload.column_id = updates.columnId ?? null
    if (updates.assignedTo !== undefined) payload.assigned_to = updates.assignedTo ?? null
    if (updates.subtasks !== undefined) payload.subtasks = updates.subtasks

    await supabase.from('tasks').update(payload).eq('id', id)

    if (updates.assignedTo !== undefined) {
      const { data } = await supabase.from('tasks').select(SELECT).eq('id', id).single()
      if (data) {
        const refreshed = toTask(data as unknown as ProjectTaskRow)
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? refreshed : t)),
          myTasks: state.myTasks.map((t) => (t.id === id ? refreshed : t)),
        }))
        return
      }
    }

    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      myTasks: state.myTasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }))
  },

  deleteTask: async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      myTasks: state.myTasks.filter((t) => t.id !== id),
    }))
  },

  toggleTaskCompleted: async (id) => {
    const task = get().tasks.find((t) => t.id === id) ?? get().myTasks.find((t) => t.id === id)
    if (!task) return
    const completed = !task.completed
    const completedAt = completed ? new Date().toISOString() : undefined
    await get().updateTask(id, { completed, completedAt })
  },

  addSubtask: async (taskId, title) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return
    const subtask: Subtask = { id: crypto.randomUUID(), title, completed: false }
    await get().updateTask(taskId, { subtasks: [...task.subtasks, subtask] })
  },

  toggleSubtask: async (taskId, subtaskId) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return
    const subtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s))
    await get().updateTask(taskId, { subtasks })
  },

  deleteSubtask: async (taskId, subtaskId) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return
    const subtasks = task.subtasks.filter((s) => s.id !== subtaskId)
    await get().updateTask(taskId, { subtasks })
  },

  moveTaskToColumn: async (taskId, _boardId, columnId) => {
    await get().updateTask(taskId, { columnId })
  },
}))
