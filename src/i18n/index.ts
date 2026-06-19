import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import pomodoroDe from './locales/de/pomodoro.json'
import pomodoroEn from './locales/en/pomodoro.json'
import commonDe from './locales/de/common.json'
import layoutDe from './locales/de/layout.json'
import dashboardDe from './locales/de/dashboard.json'
import tasksDe from './locales/de/tasks.json'
import eisenhowerDe from './locales/de/eisenhower.json'
import calendarDe from './locales/de/calendar.json'
import boardsDe from './locales/de/boards.json'
import worktimeDe from './locales/de/worktime.json'
import chatDe from './locales/de/chat.json'
import friendsDe from './locales/de/friends.json'
import socialDe from './locales/de/social.json'
import aiSchedulerDe from './locales/de/aiScheduler.json'
import settingsDe from './locales/de/settings.json'
import authDe from './locales/de/auth.json'
import legalDe from './locales/de/legal.json'

import commonEn from './locales/en/common.json'
import layoutEn from './locales/en/layout.json'
import dashboardEn from './locales/en/dashboard.json'
import tasksEn from './locales/en/tasks.json'
import eisenhowerEn from './locales/en/eisenhower.json'
import calendarEn from './locales/en/calendar.json'
import boardsEn from './locales/en/boards.json'
import worktimeEn from './locales/en/worktime.json'
import chatEn from './locales/en/chat.json'
import friendsEn from './locales/en/friends.json'
import socialEn from './locales/en/social.json'
import aiSchedulerEn from './locales/en/aiScheduler.json'
import settingsEn from './locales/en/settings.json'
import authEn from './locales/en/auth.json'
import legalEn from './locales/en/legal.json'

export const defaultNS = 'common'

export const resources = {
  de: {
    common: commonDe,
    layout: layoutDe,
    dashboard: dashboardDe,
    tasks: tasksDe,
    eisenhower: eisenhowerDe,
    calendar: calendarDe,
    boards: boardsDe,
    worktime: worktimeDe,
    chat: chatDe,
    friends: friendsDe,
    social: socialDe,
    aiScheduler: aiSchedulerDe,
    settings: settingsDe,
    auth: authDe,
    legal: legalDe,
    pomodoro: pomodoroDe,
  },
  en: {
    common: commonEn,
    layout: layoutEn,
    dashboard: dashboardEn,
    tasks: tasksEn,
    eisenhower: eisenhowerEn,
    calendar: calendarEn,
    boards: boardsEn,
    worktime: worktimeEn,
    chat: chatEn,
    friends: friendsEn,
    social: socialEn,
    aiScheduler: aiSchedulerEn,
    settings: settingsEn,
    auth: authEn,
    legal: legalEn,
    pomodoro: pomodoroEn,
  },
} as const

const STORAGE_KEY = 'flowdo-settings'

function getStoredLanguage(): 'de' | 'en' {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 'de'
    const parsed = JSON.parse(raw)
    const lang = parsed?.state?.language
    return lang === 'en' ? 'en' : 'de'
  } catch {
    return 'de'
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: getStoredLanguage(),
  fallbackLng: 'de',
  defaultNS,
  ns: Object.keys(resources.de),
  interpolation: { escapeValue: false },
})

export default i18n
