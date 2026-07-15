import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task } from '../types'

export interface MinimizedTask {
  id: string
  title: string
  type: 'personal' | 'project'
  boardId?: string
  task?: Task
}

interface TaskTrayState {
  tasks: MinimizedTask[]
  minimize: (task: MinimizedTask) => void
  remove: (id: string) => void
  clear: () => void
}

export const useTaskTrayStore = create<TaskTrayState>()(
  persist(
    (set, get) => ({
      tasks: [],
      minimize: (task) => {
        const exists = get().tasks.some((t) => t.id === task.id)
        if (!exists) {
          set({ tasks: [...get().tasks, task] })
        }
      },
      remove: (id) => {
        set({ tasks: get().tasks.filter((t) => t.id !== id) })
      },
      clear: () => set({ tasks: [] }),
    }),
    {
      name: 'flowdo-task-tray',
      version: 1,
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<TaskTrayState>),
        tasks: (persisted as TaskTrayState)?.tasks ?? current.tasks,
      }),
    }
  )
)
