import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Attachment, Task, Priority, Subtask } from '../types'
import { createId } from '../utils/id'
import { todayISO, toISODate } from '../utils/date'
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
  evening?: boolean
  someday?: boolean
  recurrence?: Task['recurrence']
  startTime?: string
  estimatedMinutes?: number
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
  evening: boolean | null
  someday: boolean | null
  recurrence: Task['recurrence'] | null
  start_time: string | null
  estimated_minutes: number | null
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
    evening: row.evening ?? undefined,
    someday: row.someday ?? undefined,
    recurrence: row.recurrence ?? undefined,
    startTime: row.start_time ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
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
    evening: task.evening ?? false,
    someday: task.someday ?? false,
    recurrence: task.recurrence ?? null,
    start_time: task.startTime ?? null,
    estimated_minutes: task.estimatedMinutes ?? null,
  })
}

function nextRecurrenceDate(dueDate: string, recurrence: Task['recurrence']): string {
  const date = parseISODate(dueDate)
  if (recurrence === 'daily') date.setDate(date.getDate() + 1)
  else if (recurrence === 'weekly') date.setDate(date.getDate() + 7)
  else if (recurrence === 'monthly') date.setMonth(date.getMonth() + 1)
  return toISODate(date)
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const pendingTaskDeletes = new Map<string, { task: Task; timer: ReturnType<typeof setTimeout> }>()

interface TasksState {
  tasks: Task[]
  taskOrder: string[]
  fetchAll: () => Promise<void>
  addTask: (input: NewTaskInput) => Task
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  undoDelete: (id: string) => void
  reorderTasks: (ids: string[]) => void
  toggleTaskCompleted: (id: string) => void
  addSubtask: (taskId: string, title: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  deleteSubtask: (taskId: string, subtaskId: string) => void
  addAttachment: (taskId: string, file: File) => Promise<{ attachment?: Attachment; error?: string }>
  removeAttachment: (taskId: string, attachmentId: string) => Promise<void>
  moveTaskToColumn: (taskId: string, boardId: string, columnId: string) => void
  subscribeToTasks: () => () => void
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],
      taskOrder: [],

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

        const merged = [...localOnly, ...remote]
        const order = get().taskOrder
        if (order.length > 0) {
          const orderMap = new Map(order.map((id, i) => [id, i]))
          merged.sort((a, b) => {
            const ai = orderMap.get(a.id) ?? Infinity
            const bi = orderMap.get(b.id) ?? Infinity
            return ai - bi
          })
        }
        set({ tasks: merged })
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
          evening: input.evening,
          someday: input.someday,
          recurrence: input.recurrence,
          startTime: input.startTime,
          estimatedMinutes: input.estimatedMinutes,
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
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }))
        const timer = setTimeout(async () => {
          pendingTaskDeletes.delete(id)
          const userId = await getUserId()
          if (userId) void supabase.from('tasks').delete().eq('id', id)
        }, 5000)
        pendingTaskDeletes.set(id, { task, timer })
      },

      undoDelete: (id) => {
        const item = pendingTaskDeletes.get(id)
        if (!item) return
        clearTimeout(item.timer)
        pendingTaskDeletes.delete(id)
        set((s) => ({ tasks: [item.task, ...s.tasks] }))
      },

      reorderTasks: (ids) => {
        set((s) => {
          const map = new Map(s.tasks.map((t) => [t.id, t]))
          const reordered = ids.map((id) => map.get(id)).filter(Boolean) as Task[]
          const rest = s.tasks.filter((t) => !ids.includes(t.id))
          return { tasks: [...reordered, ...rest], taskOrder: ids }
        })
      },

      toggleTaskCompleted: (id) => {
        const task = get().tasks.find((t) => t.id === id)
        if (!task) return
        const completed = !task.completed
        get().updateTask(id, { completed, completedAt: completed ? todayISO() : undefined })

        if (completed && task.recurrence && task.dueDate) {
          get().addTask({
            title: task.title,
            description: task.description,
            dueDate: nextRecurrenceDate(task.dueDate, task.recurrence),
            priority: task.priority,
            tags: task.tags,
            urgent: task.urgent,
            important: task.important,
            evening: task.evening,
            recurrence: task.recurrence,
          })
        }
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

      subscribeToTasks: () => {
        if (!isSupabaseConfigured) return () => {}
        let channel: ReturnType<typeof supabase.channel> | null = null
        let cancelled = false

        getUserId().then((userId) => {
          if (cancelled || !userId) return
          channel = supabase
            .channel('personal-tasks-realtime')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'tasks', filter: `owner_id=eq.${userId}` },
              () => get().fetchAll()
            )
            .subscribe()
        })

        return () => {
          cancelled = true
          if (channel) supabase.removeChannel(channel)
        }
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
