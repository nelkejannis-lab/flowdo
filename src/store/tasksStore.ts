import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Attachment, Task, Priority, Subtask } from '../types'
import { createId } from '../utils/id'
import { todayISO } from '../utils/date'
import { deleteAttachment, uploadAttachment } from '../lib/attachments'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface NewTaskInput {
  title: string
  description?: string
  dueDate?: string
  priority?: Priority
  tags?: string[]
  urgent?: boolean
  important?: boolean
  boardId?: string
  columnId?: string
}

interface TaskRow {
  id: string
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
  attachments: Attachment[]
  created_at: string
}

function toTask(row: TaskRow): Task {
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
    subtasks: row.subtasks ?? [],
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
  }
}

async function getUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

async function syncTask(task: Task, userId: string) {
  await supabase.from('tasks').upsert({
    id: task.id,
    owner_id: userId,
    title: task.title,
    description: task.description ?? null,
    due_date: task.dueDate ?? null,
    priority: task.priority,
    tags: task.tags,
    urgent: task.urgent,
    important: task.important,
    completed: task.completed,
    completed_at: task.completedAt ?? null,
    board_id: null,
    column_id: null,
    subtasks: task.subtasks,
    attachments: task.attachments,
    created_at: task.createdAt,
  })
}

interface TasksState {
  tasks: Task[]
  fetchAll: () => Promise<void>
  addTask: (input: NewTaskInput) => Task
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  toggleTaskCompleted: (id: string) => void
  addSubtask: (taskId: string, title: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  deleteSubtask: (taskId: string, subtaskId: string) => void
  addAttachment: (taskId: string, file: File) => Promise<{ attachment?: Attachment; error?: string }>
  removeAttachment: (taskId: string, attachmentId: string) => Promise<void>
  moveTaskToColumn: (taskId: string, boardId: string, columnId: string) => void
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],

      fetchAll: async () => {
        const userId = await getUserId()
        if (!userId) return

        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('owner_id', userId)
          .is('board_id', null)
          .order('created_at', { ascending: false })
        if (error) return

        const remote = ((data ?? []) as TaskRow[]).map(toTask)
        const remoteIds = new Set(remote.map((t) => t.id))
        const localOnly = get().tasks.filter((t) => !t.boardId && !remoteIds.has(t.id))

        for (const task of localOnly) {
          await syncTask(task, userId)
        }

        set({ tasks: [...localOnly, ...remote] })
      },

      addTask: (input) => {
        const task: Task = {
          id: createId(),
          title: input.title,
          description: input.description,
          dueDate: input.dueDate,
          priority: input.priority ?? 'medium',
          tags: input.tags ?? [],
          urgent: input.urgent ?? false,
          important: input.important ?? false,
          completed: false,
          boardId: input.boardId,
          columnId: input.columnId,
          subtasks: [],
          attachments: [],
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ tasks: [task, ...state.tasks] }))
        void getUserId().then((userId) => {
          if (userId && !task.boardId) void syncTask(task, userId)
        })
        return task
      },

      updateTask: (id, updates) => {
        let updated: Task | undefined
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t
            updated = { ...t, ...updates }
            return updated
          }),
        }))
        if (updated && !updated.boardId) {
          void getUserId().then((userId) => {
            if (userId && updated) void syncTask(updated, userId)
          })
        }
      },

      deleteTask: (id) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }))
        void getUserId().then((userId) => {
          if (userId) void supabase.from('tasks').delete().eq('id', id)
        })
      },

      toggleTaskCompleted: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return
        const completed = !task.completed
        get().updateTask(id, { completed, completedAt: completed ? todayISO() : undefined })
      },

      addSubtask: (taskId, title) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        const subtask: Subtask = { id: createId(), title, completed: false }
        get().updateTask(taskId, { subtasks: [...task.subtasks, subtask] })
      },

      toggleSubtask: (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        const subtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s))
        const allDone = subtasks.length > 0 && subtasks.every((s) => s.completed)
        get().updateTask(taskId, {
          subtasks,
          ...(allDone && !task.completed ? { completed: true, completedAt: todayISO() } : {}),
        })
      },

      deleteSubtask: (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        get().updateTask(taskId, { subtasks: task.subtasks.filter((s) => s.id !== subtaskId) })
      },

      addAttachment: async (taskId, file) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return { error: 'Aufgabe nicht gefunden' }
        const { attachment, error } = await uploadAttachment(`personal-tasks/${taskId}`, file)
        if (error || !attachment) return { error: error ?? 'Fehler beim Hochladen' }
        get().updateTask(taskId, { attachments: [...task.attachments, attachment] })
        return { attachment }
      },

      removeAttachment: async (taskId, attachmentId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task) return
        const attachment = task.attachments.find((a) => a.id === attachmentId)
        if (attachment) await deleteAttachment(attachment.path)
        get().updateTask(taskId, { attachments: task.attachments.filter((a) => a.id !== attachmentId) })
      },

      moveTaskToColumn: (taskId, boardId, columnId) => {
        get().updateTask(taskId, { boardId, columnId })
      },
    }),
    {
      name: 'flowdo-tasks',
      version: 1,
      migrate: (persisted) => {
        const state = persisted as TasksState
        return {
          ...state,
          tasks: (state.tasks ?? []).map((t) => ({ ...t, attachments: t.attachments ?? [] })),
        }
      },
    }
  )
)
