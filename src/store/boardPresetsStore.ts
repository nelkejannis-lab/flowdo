import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createId } from '../utils/id'
import { BOARD_TEMPLATES } from '../lib/boardTemplates'

export interface BoardPreset {
  id: string
  title: string
  description?: string
  color: string
  timeBudgetMinutes?: number
  tasks: { title: string; columnIndex: number }[]
  createdAt: string
}

interface BoardPresetsState {
  customPresets: BoardPreset[]
  logDefaults: Record<string, number>
  savePreset: (preset: Omit<BoardPreset, 'id' | 'createdAt'>) => BoardPreset
  deletePreset: (id: string) => void
  getAllPresets: () => BoardPreset[]
  setLogDefault: (boardId: string, minutes: number) => void
  getLogDefault: (boardId: string) => number
}

export const useBoardPresetsStore = create<BoardPresetsState>()(
  persist(
    (set, get) => ({
      customPresets: [],
      logDefaults: {},

      setLogDefault: (boardId, minutes) => {
        set((s) => ({ logDefaults: { ...s.logDefaults, [boardId]: minutes } }))
      },

      getLogDefault: (boardId) => get().logDefaults[boardId] ?? 30,

      savePreset: (input) => {
        const preset: BoardPreset = { ...input, id: createId(), createdAt: new Date().toISOString() }
        set((s) => ({ customPresets: [preset, ...s.customPresets] }))
        return preset
      },

      deletePreset: (id) => {
        set((s) => ({ customPresets: s.customPresets.filter((p) => p.id !== id) }))
      },

      getAllPresets: () => {
        const builtIn: BoardPreset[] = BOARD_TEMPLATES.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          color: t.color,
          tasks: t.tasks,
          createdAt: '',
        }))
        return [...get().customPresets, ...builtIn]
      },
    }),
    { name: 'flowdo-board-presets', partialize: (s) => ({ customPresets: s.customPresets, logDefaults: s.logDefaults }) }
  )
)
