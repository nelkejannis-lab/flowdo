import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '../i18n'

export type Mode = 'light' | 'dark'
export type Language = 'de' | 'en'

interface SettingsState {
  mode: Mode
  pinkAccent: boolean
  language: Language
  setMode: (mode: Mode) => void
  togglePinkAccent: () => void
  setLanguage: (language: Language) => void
}

interface LegacyState {
  theme?: 'light' | 'dark' | 'pink'
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mode: 'dark',
      pinkAccent: false,
      language: 'de',
      setMode: (mode) => set({ mode }),
      togglePinkAccent: () => set((s) => ({ pinkAccent: !s.pinkAccent })),
      setLanguage: (language) => {
        i18n.changeLanguage(language)
        set({ language })
      },
    }),
    {
      name: 'flowdo-settings',
      version: 2,
      migrate: (persisted, version) => {
        const legacy = persisted as LegacyState & Partial<SettingsState>
        if (version < 1) {
          if (legacy.theme === 'pink') return { mode: 'dark', pinkAccent: true, language: 'de' }
          if (legacy.theme === 'light') return { mode: 'light', pinkAccent: false, language: 'de' }
          return { mode: 'dark', pinkAccent: false, language: 'de' }
        }
        return { ...legacy, language: legacy.language ?? 'de' }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.language) i18n.changeLanguage(state.language)
      },
    }
  )
)
