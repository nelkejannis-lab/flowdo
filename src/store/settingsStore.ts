import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Mode = 'light' | 'dark'

interface SettingsState {
  mode: Mode
  pinkAccent: boolean
  setMode: (mode: Mode) => void
  togglePinkAccent: () => void
}

interface LegacyState {
  theme?: 'light' | 'dark' | 'pink'
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'dark',
      pinkAccent: false,
      setMode: (mode) => set({ mode }),
      togglePinkAccent: () => set((s) => ({ pinkAccent: !s.pinkAccent })),
    }),
    {
      name: 'flowdo-settings',
      version: 1,
      migrate: (persisted) => {
        const legacy = persisted as LegacyState
        if (legacy.theme === 'pink') return { mode: 'dark', pinkAccent: true }
        if (legacy.theme === 'light') return { mode: 'light', pinkAccent: false }
        return { mode: 'dark', pinkAccent: false }
      },
    }
  )
)
