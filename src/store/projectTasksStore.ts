import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { deleteAttachment, uploadAttachment } from '../lib/attachments'
import { useBoardsStore } from './boardsStore'
import { createId } from '../utils/id'
import type { Attachment, Priority, Subtask, Task } from '../types'

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
  startTime?: string
  estimatedMinutes?: number
  statusNote?: string
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
  attachments: Attachment[]
  created_at: string
  assignee: Task['assignee'] | Task['assignee'][] | null
  start_time: string | null
  estimated_minutes: number | null
  status_note: string | null
}

function single<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value
}

function toTask(row: ProjectTaskRow, dependsOn?: string[]): Task {
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
    attachments: row.attachments ?? [],
    createdAt: row.created_at,
    dependsOn,
    startTime: row.start_time ?? undefined,
    estimatedMinutes: row.estimated_minutes ?? undefined,
    statusNote: row.status_note ?? undefined,
  }
}

const SELECT = '*, assignee:profiles!tasks_assigned_to_fkey(id, username, display_name, avatar_color)'

async function fetchDependencyMap(taskIds: string[]): Promise<Record<string, string[]>> {
  if (taskIds.length === 0) return {}
  const { data } = await supabase.from('task_dependencies').select('task_id, depends_on_id').in('task_id', taskIds)
  const map: Record<string, string[]> = {}
  for (const row of (data ?? []) as { task_id: string; depends_on_id: string }[]) {
    map[row.task_id] = [...(map[row.task_id] ?? []), row.depends_on_id]
  }
  return map
}

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
  addAttachment: (taskId: string, file: File) => Promise<{ attachment?: Attachment; error?: string }>
  removeAttachment: (taskId: string, attachmentId: string) => Promise<void>
  moveTaskToColumn: (taskId: string, boardId: string, columnId: string) => Promise<void>
  addDependency: (taskId: string, dependsOnId: string) => Promise<void>
  removeDependency: (taskId: string, dependsOnId: string) => Promise<void>
  isBlocked: (taskId: string) => boolean
  subscribeToBoard: (boardId: string) => () => void
  subscribeToMyTasks: () => () => void
}

export const useProjectTasksStore = create<ProjectTasksState>()(
  persist(
    (set, get) => ({
      tasks: [],
      myTasks: [],
      loading: false,
      error: null,

      fetchTasks: async (boardId) => {
        if (!isSupabaseConfigured) return
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

        const rows = (data ?? []) as unknown as ProjectTaskRow[]
        const depMap = await fetchDependencyMap(rows.map((r) => r.id))
        const tasks = rows.map((row) => toTask(row, depMap[row.id]))
        set({ tasks, loading: false })
      },

      fetchMyTasks: async () => {
        if (!isSupabaseConfigured) return
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

        const myTasks = ((data ?? []) as unknown as ProjectTaskRow[]).map((row) => toTask(row))
        set({ myTasks })
      },

      addTask: async (input) => {
        if (!isSupabaseConfigured) {
          const taskId = createId()
          const newTask: Task = {
            id: taskId,
            ownerId: 'local',
            title: input.title,
            description: input.description ?? undefined,
            dueDate: input.dueDate ?? undefined,
            priority: input.priority ?? 'medium',
            tags: input.tags ?? [],
            urgent: input.urgent ?? false,
            important: input.important ?? false,
            completed: false,
            boardId: input.boardId,
            columnId: input.columnId ?? undefined,
            subtasks: [],
            attachments: [],
            createdAt: new Date().toISOString(),
            startTime: input.startTime,
            estimatedMinutes: input.estimatedMinutes,
            statusNote: input.statusNote,
          }
          set((state) => ({
            tasks: [newTask, ...state.tasks],
            myTasks: [newTask, ...state.myTasks],
          }))
          return { id: taskId }
        }

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
            start_time: input.startTime ?? null,
            estimated_minutes: input.estimatedMinutes ?? null,
            status_note: input.statusNote ?? null,
          })
          .select('id')
          .single()

        if (error || !data) return { error: error?.message ?? 'Fehler beim Erstellen' }
        await Promise.all([get().fetchTasks(input.boardId), get().fetchMyTasks()])
        return { id: data.id }
      },

      updateTask: async (id, updates) => {
        if (!isSupabaseConfigured) {
          set((state) => ({
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
            myTasks: state.myTasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
          }))
          return
        }

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
        if (updates.startTime !== undefined) payload.start_time = updates.startTime ?? null
        if (updates.estimatedMinutes !== undefined) payload.estimated_minutes = updates.estimatedMinutes ?? null
        if (updates.statusNote !== undefined) payload.status_note = updates.statusNote ?? null
        if (updates.subtasks !== undefined) payload.subtasks = updates.subtasks
        if (updates.attachments !== undefined) payload.attachments = updates.attachments

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
        if (!isSupabaseConfigured) {
          set((state) => ({
            tasks: state.tasks.filter((t) => t.id !== id),
            myTasks: state.myTasks.filter((t) => t.id !== id),
          }))
          return
        }

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
        const updates: Partial<Task> = { completed, completedAt }

        if (completed && task.boardId) {
          const board = useBoardsStore.getState().boards.find((b) => b.id === task.boardId)
          const doneColumn = board?.columns.find((c) => c.title === 'Erledigt')
          if (doneColumn && doneColumn.id !== task.columnId) updates.columnId = doneColumn.id
        }

        await get().updateTask(id, updates)
      },

      addSubtask: async (taskId, title) => {
        const task = get().tasks.find((t) => t.id === taskId) ?? get().myTasks.find((t) => t.id === taskId)
        if (!task) return
        const subtask: Subtask = { id: createId(), title, completed: false }
        await get().updateTask(taskId, { subtasks: [...task.subtasks, subtask] })
      },

      toggleSubtask: async (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId) ?? get().myTasks.find((t) => t.id === taskId)
        if (!task) return
        const subtasks = task.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: !s.completed } : s))
        const allDone = subtasks.length > 0 && subtasks.every((s) => s.completed)
        await get().updateTask(taskId, {
          subtasks,
          ...(allDone && !task.completed ? { completed: true, completedAt: new Date().toISOString() } : {}),
        })
      },

      deleteSubtask: async (taskId, subtaskId) => {
        const task = get().tasks.find((t) => t.id === taskId) ?? get().myTasks.find((t) => t.id === taskId)
        if (!task) return
        const subtasks = task.subtasks.filter((s) => s.id !== subtaskId)
        await get().updateTask(taskId, { subtasks })
      },

      addAttachment: async (taskId, file) => {
        if (!isSupabaseConfigured) {
          return { error: 'Attachments werden im Offline-Modus nicht unterstützt' }
        }

        const task = get().tasks.find((t) => t.id === taskId) ?? get().myTasks.find((t) => t.id === taskId)
        if (!task) return { error: 'Aufgabe nicht gefunden' }
        const { attachment, error } = await uploadAttachment(`tasks/${taskId}`, file)
        if (error || !attachment) return { error: error ?? 'Fehler beim Hochladen' }
        await get().updateTask(taskId, { attachments: [...task.attachments, attachment] })
        return { attachment }
      },

      removeAttachment: async (taskId, attachmentId) => {
        if (!isSupabaseConfigured) return

        const task = get().tasks.find((t) => t.id === taskId) ?? get().myTasks.find((t) => t.id === taskId)
        if (!task) return
        const attachment = task.attachments.find((a) => a.id === attachmentId)
        if (attachment) await deleteAttachment(attachment.path)
        await get().updateTask(taskId, { attachments: task.attachments.filter((a) => a.id !== attachmentId) })
      },

      moveTaskToColumn: async (taskId, _boardId, columnId) => {
        await get().updateTask(taskId, { columnId })
      },

      addDependency: async (taskId, dependsOnId) => {
        if (!isSupabaseConfigured) {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId ? { ...t, dependsOn: [...(t.dependsOn ?? []), dependsOnId] } : t
            ),
          }))
          return
        }

        const { error } = await supabase.from('task_dependencies').insert({ task_id: taskId, depends_on_id: dependsOnId })
        if (error) return
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, dependsOn: [...(t.dependsOn ?? []), dependsOnId] } : t
          ),
        }))
      },

      removeDependency: async (taskId, dependsOnId) => {
        if (!isSupabaseConfigured) {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId ? { ...t, dependsOn: (t.dependsOn ?? []).filter((id) => id !== dependsOnId) } : t
            ),
          }))
          return
        }

        await supabase.from('task_dependencies').delete().eq('task_id', taskId).eq('depends_on_id', dependsOnId)
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, dependsOn: (t.dependsOn ?? []).filter((id) => id !== dependsOnId) } : t
          ),
        }))
      },

      isBlocked: (taskId) => {
        const task = get().tasks.find((t) => t.id === taskId)
        if (!task || !task.dependsOn || task.dependsOn.length === 0) return false
        return task.dependsOn.some((depId) => {
          const dep = get().tasks.find((t) => t.id === depId)
          return dep ? !dep.completed : false
        })
      },

      subscribeToBoard: (boardId) => {
        if (!isSupabaseConfigured) return () => {}
        const channel = supabase
          .channel(`board-tasks-${boardId}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `board_id=eq.${boardId}` }, () => {
            get().fetchTasks(boardId)
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'task_dependencies' }, () => {
            get().fetchTasks(boardId)
          })
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      },

      // Keep the cross-board "my project tasks" list fresh (used by the dashboard
      // Tagesübersicht). Any change to a project task refetches it.
      subscribeToMyTasks: () => {
        if (!isSupabaseConfigured) return () => {}
        const channel = supabase
          .channel('my-project-tasks')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
            get().fetchMyTasks()
          })
          .subscribe()

        return () => {
          supabase.removeChannel(channel)
        }
      },
    }),
    { name: 'flowdo-project-tasks' }
  )
)
