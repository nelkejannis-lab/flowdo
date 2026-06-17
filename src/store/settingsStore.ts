import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '../i18n'
import { NAMED_COLORS } from './eventsStore'

export type Mode = 'light' | 'dark'
export type Language = 'de' | 'en'
export type FeatureKey = 'calendar' | 'eisenhower' | 'worktime' | 'aiScheduler' | 'chat' | 'friends' | 'social' | 'weather'

export const DEFAULT_FEATURE_VISIBILITY: Record<FeatureKey, boolean> = {
  calendar: true,
  eisenhower: true,
  worktime: true,
  aiScheduler: true,
  chat: true,
  friends: true,
  social: true,
  weather: true,
}

export type DashboardWidget = 'weather' | 'stats' | 'todayTasks' | 'upcomingDeadlines' | 'nextEvents' | 'projectsOverview'

export const DEFAULT_DASHBOARD_VISIBILITY: Record<DashboardWidget, boolean> = {
  weather: true,
  stats: true,
  todayTasks: true,
  upcomingDeadlines: true,
  nextEvents: true,
  projectsOverview: true,
}

export const DEFAULT_COLOR_LABELS: Record<string, string> = Object.fromEntries(
  NAMED_COLORS.map((c) => [c.hex, c.label])
)

interface SettingsState {
  mode: Mode
  pinkAccent: boolean
  language: Language
  featureVisibility: Record<FeatureKey, boolean>
  dashboardVisibility: Record<DashboardWidget, boolean>
  colorLabels: Record<string, string>
  notifyAppointments: boolean
  notifyChat: boolean
  notifyTasks: boolean
  appointmentReminderMinutes: number
  onboardingPermissionsDone: boolean
  weatherCity: string
  setMode: (mode: Mode) => void
  togglePinkAccent: () => void
  setLanguage: (language: Language) => void
  toggleFeature: (key: FeatureKey) => void
  toggleDashboardWidget: (key: DashboardWidget) => void
  setColorLabel: (hex: string, label: string) => void
  setNotifyAppointments: (v: boolean) => void
  setNotifyChat: (v: boolean) => void
  setNotifyTasks: (v: boolean) => void
  setAppointmentReminderMinutes: (v: number) => void
  setOnboardingPermissionsDone: () => void
  setWeatherCity: (city: string) => void
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
      featureVisibility: { ...DEFAULT_FEATURE_VISIBILITY },
      dashboardVisibility: { ...DEFAULT_DASHBOARD_VISIBILITY },
      colorLabels: { ...DEFAULT_COLOR_LABELS },
      notifyAppointments: true,
      notifyChat: true,
      notifyTasks: true,
      appointmentReminderMinutes: 15,
      onboardingPermissionsDone: false,
      weatherCity: 'Eneppetal',
      setMode: (mode) => set({ mode }),
      togglePinkAccent: () => set((s) => ({ pinkAccent: !s.pinkAccent })),
      setLanguage: (language) => {
        i18n.changeLanguage(language)
        set({ language })
      },
      toggleFeature: (key) =>
        set((s) => ({ featureVisibility: { ...s.featureVisibility, [key]: !s.featureVisibility[key] } })),
      toggleDashboardWidget: (key) =>
        set((s) => ({ dashboardVisibility: { ...s.dashboardVisibility, [key]: !s.dashboardVisibility[key] } })),
      setColorLabel: (hex, label) =>
        set((s) => ({ colorLabels: { ...s.colorLabels, [hex]: label } })),
      setNotifyAppointments: (v) => set({ notifyAppointments: v }),
      setNotifyChat: (v) => set({ notifyChat: v }),
      setNotifyTasks: (v) => set({ notifyTasks: v }),
      setAppointmentReminderMinutes: (v) => set({ appointmentReminderMinutes: v }),
      setOnboardingPermissionsDone: () => set({ onboardingPermissionsDone: true }),
      setWeatherCity: (city) => set({ weatherCity: city }),
    }),
    {
      name: 'flowdo-settings',
      version: 8, // bumped: add weatherCity, remove GPS, default Eneppetal
      migrate: (persisted, version) => {
        const legacy = persisted as LegacyState & Partial<SettingsState>
        if (version < 1) {
          return {
            mode: legacy.theme === 'light' ? 'light' : 'dark',
            pinkAccent: legacy.theme === 'pink',
            language: 'de',
            featureVisibility: { ...DEFAULT_FEATURE_VISIBILITY },
            dashboardVisibility: { ...DEFAULT_DASHBOARD_VISIBILITY },
          }
        }
        return {
          ...legacy,
          language: legacy.language ?? 'de',
          featureVisibility: { ...DEFAULT_FEATURE_VISIBILITY, ...legacy.featureVisibility },
          dashboardVisibility: { ...DEFAULT_DASHBOARD_VISIBILITY },
          colorLabels: { ...DEFAULT_COLOR_LABELS, ...(legacy as any).colorLabels },
          onboardingPermissionsDone: false,
          weatherCity: (legacy as any).weatherCity ?? 'Eneppetal',
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.language) i18n.changeLanguage(state.language)
      },
    }
  )
)
