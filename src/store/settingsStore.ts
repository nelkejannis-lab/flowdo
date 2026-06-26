import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '../i18n'
import { NAMED_COLORS } from './eventsStore'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'

export type Mode = 'light' | 'dark'
export type Language = 'de' | 'en'
export type FeatureKey = 'calendar' | 'eisenhower' | 'worktime' | 'aiScheduler' | 'chat' | 'friends' | 'social' | 'weather'

export type NavItemKey =
  | 'dashboard'
  | 'week'
  | 'inbox'
  | 'tasks'
  | 'calendar'
  | 'termine'
  | 'pomodoro'
  | 'brain'
  | 'eisenhower'
  | 'worktime'
  | 'aiScheduler'
  | 'chat'
  | 'friends'
  | 'social'
  | 'meetings'
  | 'projekte'

export const DEFAULT_NAV_ORDER: NavItemKey[] = [
  'dashboard',
  'week',
  'inbox',
  'tasks',
  'calendar',
  'termine',
  'pomodoro',
  'brain',
  'eisenhower',
  'worktime',
  'aiScheduler',
  'chat',
  'friends',
  'social',
  'meetings',
  'projekte',
]

// Items that can never be hidden
export const NAV_ALWAYS_VISIBLE: NavItemKey[] = ['dashboard', 'calendar']

export const DEFAULT_NAV_VISIBILITY: Record<NavItemKey, boolean> = {
  dashboard: true,
  week: true,
  inbox: true,
  tasks: true,
  calendar: true,
  termine: true,
  pomodoro: true,
  brain: true,
  eisenhower: true,
  worktime: true,
  aiScheduler: true,
  chat: true,
  friends: true,
  social: true,
  meetings: true,
  projekte: true,
}

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

export type DashboardWidget = 'weather' | 'stats' | 'todayTasks' | 'upcomingDeadlines' | 'nextEvents' | 'projectsOverview' | 'productivity' | 'workoffice'

export const DEFAULT_DASHBOARD_VISIBILITY: Record<DashboardWidget, boolean> = {
  weather: true,
  stats: true,
  todayTasks: true,
  upcomingDeadlines: true,
  nextEvents: true,
  projectsOverview: true,
  productivity: true,
  workoffice: true,
}

export const DEFAULT_DASHBOARD_WIDGET_ORDER = ['weather', 'productivity', 'workoffice', 'stats_week', 'stats_projects']

export const DEFAULT_COLOR_LABELS: Record<string, string> = Object.fromEntries(
  NAMED_COLORS.map((c) => [c.hex, c.label])
)

// Default: Ennepetal 58256
const DEFAULT_WEATHER_CITY = 'Ennepetal'
const DEFAULT_WEATHER_COORDS = { lat: 51.2957, lon: 7.3575 }

interface WeatherCoords { lat: number; lon: number }

interface SettingsState {
  mode: Mode
  pinkAccent: boolean
  language: Language
  featureVisibility: Record<FeatureKey, boolean>
  dashboardVisibility: Record<DashboardWidget, boolean>
  colorLabels: Record<string, string>
  navOrder: NavItemKey[]
  navVisibility: Record<NavItemKey, boolean>
  notifyAppointments: boolean
  notifyChat: boolean
  notifyTasks: boolean
  appointmentReminderMinutes: number
  onboardingPermissionsDone: boolean
  weatherCity: string
  weatherCoords: WeatherCoords
  hideCompletedTasks: boolean
  dashboardWidgetOrder: string[]
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
  setNavOrder: (order: NavItemKey[]) => void
  toggleNavItem: (key: NavItemKey) => void
  setWeatherCity: (city: string) => void
  setWeatherCoords: (coords: WeatherCoords) => void
  setDashboardWidgetOrder: (order: string[]) => void
  toggleHideCompletedTasks: () => void
  importSettings: (settings: any) => void
  resetSettings: () => void
  syncNow: () => void
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
      navOrder: [...DEFAULT_NAV_ORDER],
      navVisibility: { ...DEFAULT_NAV_VISIBILITY },
      colorLabels: { ...DEFAULT_COLOR_LABELS },
      notifyAppointments: true,
      notifyChat: true,
      notifyTasks: true,
      appointmentReminderMinutes: 15,
      onboardingPermissionsDone: false,
      weatherCity: DEFAULT_WEATHER_CITY,
      weatherCoords: { ...DEFAULT_WEATHER_COORDS },
      hideCompletedTasks: true,
      dashboardWidgetOrder: [...DEFAULT_DASHBOARD_WIDGET_ORDER],
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
      setNavOrder: (navOrder) => set({ navOrder }),
      toggleNavItem: (key) =>
        set((s) => ({
          navVisibility: {
            ...s.navVisibility,
            [key]: !s.navVisibility[key],
          },
        })),
      setWeatherCity: (city) => set({ weatherCity: city }),
      setWeatherCoords: (coords) => set({ weatherCoords: coords }),
      setDashboardWidgetOrder: (dashboardWidgetOrder) => set({ dashboardWidgetOrder }),
      toggleHideCompletedTasks: () => set((s) => ({ hideCompletedTasks: !s.hideCompletedTasks })),
      importSettings: (settings) => {
        if (!settings) return
        set((state) => ({
          ...state,
          mode: settings.mode ?? state.mode,
          pinkAccent: settings.pinkAccent ?? state.pinkAccent,
          language: settings.language ?? state.language,
          featureVisibility: { ...state.featureVisibility, ...settings.featureVisibility },
          dashboardVisibility: { ...state.dashboardVisibility, ...settings.dashboardVisibility },
          colorLabels: { ...state.colorLabels, ...settings.colorLabels },
          navOrder: settings.navOrder ?? state.navOrder,
          navVisibility: { ...state.navVisibility, ...settings.navVisibility },
          notifyAppointments: settings.notifyAppointments ?? state.notifyAppointments,
          notifyChat: settings.notifyChat ?? state.notifyChat,
          notifyTasks: settings.notifyTasks ?? state.notifyTasks,
          appointmentReminderMinutes: settings.appointmentReminderMinutes ?? state.appointmentReminderMinutes,
          onboardingPermissionsDone: settings.onboardingPermissionsDone ?? state.onboardingPermissionsDone,
          weatherCity: settings.weatherCity ?? state.weatherCity,
          weatherCoords: settings.weatherCoords ?? state.weatherCoords,
          hideCompletedTasks: settings.hideCompletedTasks ?? state.hideCompletedTasks,
          dashboardWidgetOrder: settings.dashboardWidgetOrder ?? state.dashboardWidgetOrder,
        }))
      },
      resetSettings: () => {
        set({
          mode: 'dark',
          pinkAccent: false,
          language: 'de',
          featureVisibility: { ...DEFAULT_FEATURE_VISIBILITY },
          dashboardVisibility: { ...DEFAULT_DASHBOARD_VISIBILITY },
          navOrder: [...DEFAULT_NAV_ORDER],
          navVisibility: { ...DEFAULT_NAV_VISIBILITY },
          colorLabels: { ...DEFAULT_COLOR_LABELS },
          notifyAppointments: true,
          notifyChat: true,
          notifyTasks: true,
          appointmentReminderMinutes: 15,
          onboardingPermissionsDone: false,
          weatherCity: DEFAULT_WEATHER_CITY,
          weatherCoords: { ...DEFAULT_WEATHER_COORDS },
          hideCompletedTasks: true,
          dashboardWidgetOrder: [...DEFAULT_DASHBOARD_WIDGET_ORDER],
        })
      },
      syncNow: () => {
        const state = useSettingsStore.getState()
        const auth = useAuthStore.getState()
        const userId = auth.user?.id
        if (!userId) return
        const payload = getSettingsPayload(state)
        supabase.from('profiles').update({ settings: payload }).eq('id', userId).then(({ error }) => {
          if (!error && auth.profile) {
            useAuthStore.setState({
              profile: {
                ...auth.profile,
                settings: payload,
              },
            })
          }
        })
      },
    }),
    {
      name: 'flowdo-settings',
      version: 11,
      migrate: (persisted, version) => {
        const legacy = persisted as LegacyState & Partial<SettingsState>
        if (version < 1) {
          return {
            mode: legacy.theme === 'light' ? 'light' : 'dark',
            pinkAccent: legacy.theme === 'pink',
            language: 'de',
            featureVisibility: { ...DEFAULT_FEATURE_VISIBILITY },
            dashboardVisibility: { ...DEFAULT_DASHBOARD_VISIBILITY },
            dashboardWidgetOrder: [...DEFAULT_DASHBOARD_WIDGET_ORDER],
          }
        }
        const city = (legacy as any).weatherCity
        const hasCustomCity = city && city !== 'Eneppetal' && city !== 'Ennepetal'
        const existingNavOrder = ((legacy as any).navOrder ?? []) as NavItemKey[]
        const missingNavItems = DEFAULT_NAV_ORDER.filter((k) => !existingNavOrder.includes(k))
        const mergedNavOrder = existingNavOrder.length > 0 ? [...existingNavOrder, ...missingNavItems] : [...DEFAULT_NAV_ORDER]
        return {
          ...legacy,
          language: legacy.language ?? 'de',
          featureVisibility: { ...DEFAULT_FEATURE_VISIBILITY, ...legacy.featureVisibility },
          dashboardVisibility: { ...DEFAULT_DASHBOARD_VISIBILITY, ...legacy.dashboardVisibility },
          navOrder: mergedNavOrder,
          navVisibility: { ...DEFAULT_NAV_VISIBILITY, ...(legacy as any).navVisibility },
          colorLabels: { ...DEFAULT_COLOR_LABELS, ...(legacy as any).colorLabels },
          onboardingPermissionsDone: legacy.onboardingPermissionsDone ?? false,
          weatherCity: hasCustomCity ? city : DEFAULT_WEATHER_CITY,
          weatherCoords: (legacy as any).weatherCoords ?? { ...DEFAULT_WEATHER_COORDS },
          dashboardWidgetOrder: (legacy as any).dashboardWidgetOrder ?? [...DEFAULT_DASHBOARD_WIDGET_ORDER],
        }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.language) i18n.changeLanguage(state.language)
      },
    }
  )
)

export function getSettingsPayload(state: any) {
  return {
    mode: state.mode,
    pinkAccent: state.pinkAccent,
    language: state.language,
    featureVisibility: state.featureVisibility,
    dashboardVisibility: state.dashboardVisibility,
    colorLabels: state.colorLabels,
    navOrder: state.navOrder,
    navVisibility: state.navVisibility,
    notifyAppointments: state.notifyAppointments,
    notifyChat: state.notifyChat,
    notifyTasks: state.notifyTasks,
    appointmentReminderMinutes: state.appointmentReminderMinutes,
    onboardingPermissionsDone: state.onboardingPermissionsDone,
    weatherCity: state.weatherCity,
    weatherCoords: state.weatherCoords,
    hideCompletedTasks: state.hideCompletedTasks,
    dashboardWidgetOrder: state.dashboardWidgetOrder,
  }
}

// Sync listener
let syncTimeout: any = null
useSettingsStore.subscribe((state) => {
  const auth = useAuthStore.getState()
  const userId = auth.user?.id
  const profile = auth.profile
  if (!userId || !profile) return

  const payload = getSettingsPayload(state)
  const profileSettings = profile.settings

  // Skip syncing if settings haven't changed from the database version
  if (profileSettings && JSON.stringify(profileSettings) === JSON.stringify(payload)) {
    if (syncTimeout) {
      clearTimeout(syncTimeout)
      syncTimeout = null
    }
    return
  }

  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    supabase
      .from('profiles')
      .update({ settings: payload })
      .eq('id', userId)
      .then(({ error }) => {
        if (!error && auth.profile) {
          useAuthStore.setState({
            profile: {
              ...auth.profile,
              settings: payload,
            },
          })
        }
      })
  }, 1000)
})
