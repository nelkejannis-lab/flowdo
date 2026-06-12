import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'pink'

interface SettingsState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const order: Theme[] = ['light', 'dark', 'pink']

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        const next = order[(order.indexOf(get().theme) + 1) % order.length]
        set({ theme: next })
      },
    }),
    { name: 'flowdo-settings' }
  )
)
