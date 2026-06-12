import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task, Priority, Subtask } from '../types'
import { createId } from '../utils/id'
import { todayISO } from '../utils/date'

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

interface TasksState {
  tasks: Task[]
  addTask: (input: NewTaskInput) => Task
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  toggleTaskCompleted: (id: string) => void
  addSubtask: (taskId: string, title: string) => void
  toggleSubtask: (taskId: string, subtaskId: string) => void
  deleteSubtask: (taskId: string, subtaskId: string) => void
  moveTaskToColumn: (taskId: string, boardId: string, columnId: string) => void
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: [],

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
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ tasks: [task, ...state.tasks] }))
        return task
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }))
      },

      deleteTask: (id) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }))
      },

      toggleTaskCompleted: (id) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  completed: !t.completed,
                  completedAt: !t.completed ? todayISO() : undefined,
                }
              : t
          ),
        }))
      },

      addSubtask: (taskId, title) => {
        const subtask: Subtask = { id: createId(), title, completed: false }
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t
          ),
        }))
      },

      toggleSubtask: (taskId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) =>
                    s.id === subtaskId ? { ...s, completed: !s.completed } : s
                  ),
                }
              : t
          ),
        }))
      },

      deleteSubtask: (taskId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
              : t
          ),
        }))
      },

      moveTaskToColumn: (taskId, boardId, columnId) => {
        get().updateTask(taskId, { boardId, columnId })
      },
    }),
    { name: 'flowdo-tasks' }
  )
)
