import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BarChart2, Bell, CalendarClock, CalendarDays, CheckSquare, Clock, Cloud, Download, Eye, EyeOff, FolderKanban, Grid2x2, Instagram, Loader2, MapPin, MessageCircle, Plus, RefreshCw, Sparkles, Trash2, Upload, Users, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { uploadAvatar } from '../lib/avatar'
import { BOARD_COLORS } from '../store/boardsStore'
import { useCalendarConnectionsStore } from '../store/calendarConnectionsStore'
import { useSettingsStore, type DashboardWidget, type FeatureKey } from '../store/settingsStore'
import { useWorkTimeStore } from '../store/workTimeStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { useSearchParams } from 'react-router-dom'
import { requestPermission, canNotify } from '../utils/notifications'
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts'
import type { WorkProfile } from '../types'

const FEATURE_ICONS: Record<FeatureKey, React.ReactNode> = {
  calendar: <CalendarDays size={18} />,
  eisenhower: <Grid2x2 size={18} />,
  worktime: <Clock size={18} />,
  aiScheduler: <Sparkles size={18} />,
  chat: <MessageCircle size={18} />,
  friends: <Users size={18} />,
  social: <Instagram size={18} />,
  weather: <Cloud size={18} />,
}

const SUPABASE_ONLY_FEATURES: FeatureKey[] = ['aiScheduler', 'chat', 'friends', 'social']

interface PlaceSuggestion { display_name: string; lat: string; lon: string }

function shortPlaceName(s: PlaceSuggestion) {
  return s.display_name.split(', ').slice(0, 3).join(', ')
}

function WeatherCitySettings() {
  const weatherCity = useSettingsStore((s) => s.weatherCity)
  const setWeatherCity = useSettingsStore((s) => s.setWeatherCity)
  const setWeatherCoords = useSettingsStore((s) => s.setWeatherCoords)
  const [input, setInput] = useState(weatherCity)
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [saved, setSaved] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchAbort = useRef<AbortController | null>(null)

  useEffect(() => { setInput(weatherCity) }, [weatherCity])

  function onInput(val: string) {
    setInput(val)
    setSaved(false)
    if (debounce.current) clearTimeout(debounce.current)
    searchAbort.current?.abort()
    if (val.trim().length < 2) { setSuggestions([]); return }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      searchAbort.current = new AbortController()
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&accept-language=de`,
          { signal: searchAbort.current.signal }
        )
        setSuggestions(await res.json())
      } catch { /* aborted */ } finally { setSearching(false) }
    }, 350)
  }

  function select(s: PlaceSuggestion) {
    const name = shortPlaceName(s)
    setWeatherCity(name)
    setWeatherCoords({ lat: parseFloat(s.lat), lon: parseFloat(s.lon) })
    setInput(name)
    setSuggestions([])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <div className="mb-3 flex items-center gap-2">
        <MapPin size={16} className="text-accent" />
        <h2 className="text-sm font-semibold">Wetter-Standort / Weather location</h2>
      </div>
      <p className="mb-3 text-xs text-gray-400">Stadt oder PLZ — auch direkt im Widget änderbar. / City or ZIP — can also be changed in the widget.</p>
      <div className="relative">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSuggestions([])}
            placeholder="z.B. Ennepetal oder 58256"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
          {searching && <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent flex-shrink-0" />}
          {saved && <span className="text-xs font-semibold text-[#34c759]">✓ Gespeichert</span>}
        </div>
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-gray-100 bg-white shadow-lg dark:border-racing-700 dark:bg-racing-800">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => select(s)}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-racing-700 first:rounded-t-xl last:rounded-b-xl">
                <MapPin size={12} className="flex-shrink-0 text-accent" />
                <span className="truncate">{shortPlaceName(s)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation(['settings', 'common'])
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const featureVisibility = useSettingsStore((s) => s.featureVisibility)
  const toggleFeature = useSettingsStore((s) => s.toggleFeature)
  const dashboardVisibility = useSettingsStore((s) => s.dashboardVisibility)
  const toggleDashboardWidget = useSettingsStore((s) => s.toggleDashboardWidget)
  const notifyAppointments = useSettingsStore((s) => s.notifyAppointments)
  const notifyChat = useSettingsStore((s) => s.notifyChat)
  const notifyTasks = useSettingsStore((s) => s.notifyTasks)
  const appointmentReminderMinutes = useSettingsStore((s) => s.appointmentReminderMinutes)
  const setNotifyAppointments = useSettingsStore((s) => s.setNotifyAppointments)
  const setNotifyChat = useSettingsStore((s) => s.setNotifyChat)
  const setNotifyTasks = useSettingsStore((s) => s.setNotifyTasks)
  const setAppointmentReminderMinutes = useSettingsStore((s) => s.setAppointmentReminderMinutes)
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    canNotify() ? Notification.permission : 'denied'
  )
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const exportUserData = useAuthStore((s) => s.exportUserData)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [birthday, setBirthday] = useState(profile?.birthday ?? '')
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? '')
  const [workLocation, setWorkLocation] = useState(profile?.work_location ?? '')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  const [searchParams] = useSearchParams()
  const workProfiles = useWorkTimeStore((s) => s.workProfiles)
  const activeProfileId = useWorkTimeStore((s) => s.activeProfileId)
  const applyWorkProfile = useWorkTimeStore((s) => s.applyWorkProfile)
  const addWorkProfile = useWorkTimeStore((s) => s.addWorkProfile)
  const deleteWorkProfile = useWorkTimeStore((s) => s.deleteWorkProfile)
  const [showAddProfile, setShowAddProfile] = useState(false)
  const [newProfile, setNewProfile] = useState<Omit<WorkProfile, 'id'>>({ name: '', weeklyHours: 38.5, workDaysPerWeek: 5, defaultBreakMinutes: 45 })

  const [activeTab, setActiveTab] = useState<'profil' | 'kalender' | 'funktionen' | 'datenschutz' | 'tastenkuerzel' | 'arbeitszeit'>(searchParams.get('tab') === 'kalender' ? 'kalender' : 'profil')
  const connections = useCalendarConnectionsStore((s) => s.connections)
  const fetchConnections = useCalendarConnectionsStore((s) => s.fetch)
  const disconnectCalendar = useCalendarConnectionsStore((s) => s.disconnect)
  const connectIcal = useCalendarConnectionsStore((s) => s.connectIcal)
  const startOAuth = useCalendarConnectionsStore((s) => s.startOAuth)
  const syncCalendars = useCalendarConnectionsStore((s) => s.sync)
  const syncing = useCalendarConnectionsStore((s) => s.syncing)
  const [icalUrl, setIcalUrl] = useState('')
  const [icalError, setIcalError] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const connectedParam = searchParams.get('connected')
  const errorParam = searchParams.get('error')

  useEffect(() => { fetchConnections() }, [fetchConnections])
  useEffect(() => {
    if (connectedParam) setSyncResult(`✓ ${connectedParam === 'google' ? 'Google Calendar' : 'Outlook'} ${t('calendar.connectedSuffix')}`)
    if (errorParam) setSyncResult(`${t('calendar.errorPrefix')}: ${decodeURIComponent(errorParam)}`)
  }, [connectedParam, errorParam, t])

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name)
      setUsername(profile.username)
      setBirthday(profile.birthday ?? '')
      setJobTitle(profile.job_title ?? '')
      setWorkLocation(profile.work_location ?? '')
    }
  }, [profile])

  if (!profile || !user) return null

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)
    setSavingProfile(true)
    const err = await updateProfile({
      display_name: displayName.trim(),
      username: username.trim(),
      job_title: jobTitle.trim() || null,
      work_location: workLocation.trim() || null,
      birthday: birthday || null,
    })
    setSavingProfile(false)
    if (err) setProfileError(err)
    else setProfileSuccess(t('profile.saveSuccess'))
  }

  async function handleAvatarFile(file: File | null) {
    if (!file || !user) return
    setAvatarError(null)
    setUploadingAvatar(true)
    const { url, error } = await uploadAvatar(user.id, file)
    if (error || !url) {
      setAvatarError(error ?? t('profile.uploadError'))
      setUploadingAvatar(false)
      return
    }
    const updateErr = await updateProfile({ avatar_url: url })
    setUploadingAvatar(false)
    if (updateErr) setAvatarError(updateErr)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleColorChange(color: string) {
    await updateProfile({ avatar_color: color })
  }

  async function handleRemoveAvatar() {
    setAvatarError(null)
    const err = await updateProfile({ avatar_url: null })
    if (err) setAvatarError(err)
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)
    if (newPassword.length < 8) {
      setPasswordError(t('password.errorTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('password.errorMismatch'))
      return
    }
    setSavingPassword(true)
    const err = await updatePassword(newPassword)
    setSavingPassword(false)
    if (err) {
      setPasswordError(err)
    } else {
      setPasswordSuccess(t('password.changeSuccess'))
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function handleExport() {
    setExportError(null)
    setExporting(true)
    const err = await exportUserData()
    setExporting(false)
    if (err) setExportError(err)
  }

  async function handleDeleteAccount() {
    setDeleteError(null)
    setDeleting(true)
    const err = await deleteAccount()
    setDeleting(false)
    if (err) setDeleteError(err)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-gray-200 p-1 dark:border-racing-700 sm:w-fit">
        {(['profil', 'kalender', 'funktionen', 'arbeitszeit', 'datenschutz', 'tastenkuerzel'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium capitalize ${activeTab === tab ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'}`}
          >
            {tab === 'tastenkuerzel' ? 'Tastenkürzel' : tab === 'arbeitszeit' ? 'Arbeitszeit' : t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      {activeTab === 'kalender' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <h2 className="mb-1 text-sm font-semibold">{t('calendar.title')}</h2>
            <p className="mb-4 text-xs text-gray-400">{t('calendar.description')}</p>

            {syncResult && (
              <p className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${syncResult.startsWith(t('calendar.errorPrefix')) ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                {syncResult}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {/* Google — temporarily hidden */}

              {/* Microsoft */}
              {(() => {
                const conn = connections.find((c) => c.provider === 'microsoft')
                return (
                  <div className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 dark:border-racing-800">
                    <span className="text-xl">📧</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t('calendar.outlook')}</p>
                      {conn ? <p className="text-xs text-emerald-500">✓ {t('calendar.connected')}{conn.email ? ` · ${conn.email}` : ''}</p>
                             : <p className="text-xs text-gray-400">{t('calendar.notConnected')}</p>}
                    </div>
                    {conn
                      ? <button onClick={() => disconnectCalendar('microsoft')} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:border-red-300 hover:text-red-500 dark:border-racing-700"><X size={12} /> {t('calendar.disconnect')}</button>
                      : <button onClick={() => startOAuth('microsoft')} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark">{t('calendar.connect')}</button>
                    }
                  </div>
                )
              })()}

              {/* iCloud / iCal */}
              {(() => {
                const conn = connections.find((c) => c.provider === 'ical')
                return (
                  <div className="rounded-lg border border-gray-100 p-3 dark:border-racing-800">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">☁️</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t('calendar.icloud')}</p>
                        {conn ? <p className="text-xs text-emerald-500">✓ {t('calendar.connected')}</p>
                               : <p className="text-xs text-gray-400">{t('calendar.icloudPlaceholder')}</p>}
                      </div>
                      {conn && <button onClick={() => disconnectCalendar('ical')} className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:border-red-300 hover:text-red-500 dark:border-racing-700"><X size={12} /> {t('calendar.disconnect')}</button>}
                    </div>
                    {!conn && (
                      <div className="mt-2 flex gap-2">
                        <input
                          value={icalUrl}
                          onChange={(e) => setIcalUrl(e.target.value)}
                          placeholder={t('calendar.urlPlaceholder')}
                          className="flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-1.5 text-xs focus:border-accent focus:outline-none dark:border-racing-700"
                        />
                        <button
                          onClick={async () => {
                            setIcalError(null)
                            const err = await connectIcal(icalUrl)
                            if (err) setIcalError(err)
                            else setIcalUrl('')
                          }}
                          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                        >
                          {t('calendar.add')}
                        </button>
                      </div>
                    )}
                    {icalError && <p className="mt-1 text-xs text-red-500">{icalError}</p>}
                    <p className="mt-2 text-xs text-gray-400">
                      {t('calendar.icloudHint')}
                    </p>
                  </div>
                )
              })()}
            </div>

            {connections.length > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-racing-800">
                <div>
                  <p className="text-xs text-gray-400">
                    {t('calendar.lastSynced', {
                      date: connections.find((c) => c.lastSyncedAt)
                        ? new Date(connections.find((c) => c.lastSyncedAt)!.lastSyncedAt!).toLocaleString(i18n.language === 'en' ? 'en-US' : 'de-DE')
                        : t('calendar.never'),
                    })}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    setSyncResult(null)
                    const result = await syncCalendars()
                    setSyncResult(result.errors.length > 0
                      ? `${t('calendar.errorPrefix')}: ${result.errors.join(', ')}`
                      : `✓ ${t('calendar.syncedPrefix')}: ${result.synced.join(', ')}`)
                  }}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
                >
                  {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  {syncing ? t('calendar.syncing') : t('calendar.syncNow')}
                </button>
              </div>
            )}
          </div>

          {connections.length < 2 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-500 dark:border-racing-800 dark:bg-racing-800/50 dark:text-racing-300">
              {t('calendar.fewConnections')}
            </div>
          )}
        </div>
      )}

      {activeTab === 'funktionen' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <h2 className="mb-1 text-sm font-semibold">{t('features.title')}</h2>
            <p className="mb-3 text-xs text-gray-400">{t('features.description')}</p>
            <div className="flex flex-col divide-y divide-gray-100 dark:divide-racing-800">
              {(Object.keys(FEATURE_ICONS) as FeatureKey[])
                .filter((key) => !SUPABASE_ONLY_FEATURES.includes(key) || isSupabaseConfigured)
                .map((key) => {
                  const enabled = featureVisibility[key]
                  return (
                    <div key={key} className="flex items-center gap-3 py-3">
                      <span className="flex-shrink-0 text-gray-400">{FEATURE_ICONS[key]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t(`features.items.${key}.label`)}</p>
                        <p className="text-xs text-gray-400">{t(`features.items.${key}.description`)}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        onClick={() => toggleFeature(key)}
                        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${enabled ? 'bg-[#34c759]' : 'bg-gray-200 dark:bg-racing-700'}`}
                      >
                        <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Dashboard */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <h2 className="mb-1 text-sm font-semibold">Dashboard</h2>
            <p className="mb-3 text-xs text-gray-400">Wähle aus, was auf deinem Dashboard angezeigt wird.</p>
            <div className="flex flex-col divide-y divide-gray-100 dark:divide-racing-800">
              {([
                { key: 'weather' as DashboardWidget, icon: <Cloud size={18} />, label: 'Wetter', desc: 'Aktuelles Wetter deines Standorts' },
                { key: 'stats' as DashboardWidget, icon: <BarChart2 size={18} />, label: 'Statistiken', desc: 'Aufgaben, Projekte und Arbeitszeit' },
                { key: 'todayTasks' as DashboardWidget, icon: <CheckSquare size={18} />, label: 'Heute', desc: 'Heutige Aufgaben und Termine' },
                { key: 'upcomingDeadlines' as DashboardWidget, icon: <Clock size={18} />, label: 'Deadlines', desc: 'Anstehende Projekt-Deadlines' },
                { key: 'nextEvents' as DashboardWidget, icon: <CalendarClock size={18} />, label: 'Events', desc: 'Nächste Ereignisse' },
                { key: 'projectsOverview' as DashboardWidget, icon: <FolderKanban size={18} />, label: 'Projektübersicht', desc: 'Alle aktiven Projekte' },
              ]).map(({ key, icon, label, desc }) => {
                const enabled = dashboardVisibility[key]
                return (
                  <div key={key} className="flex items-center gap-3 py-3">
                    <span className="flex-shrink-0 text-gray-400">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-gray-400">{desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => toggleDashboardWidget(key)}
                      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${enabled ? 'bg-[#34c759]' : 'bg-gray-200 dark:bg-racing-700'}`}
                    >
                      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Benachrichtigungen */}
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <div className="mb-3 flex items-center gap-2">
              <Bell size={16} className="text-accent" />
              <h2 className="text-sm font-semibold">Benachrichtigungen</h2>
            </div>

            {!canNotify() ? (
              <p className="text-xs text-gray-400">Dein Browser unterstützt keine Benachrichtigungen.</p>
            ) : notifPermission !== 'granted' ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-400">
                  {notifPermission === 'denied'
                    ? 'Benachrichtigungen wurden blockiert. Bitte erlaube sie in den Browser-Einstellungen.'
                    : 'Erlaube Browser-Benachrichtigungen um Erinnerungen zu erhalten.'}
                </p>
                {notifPermission !== 'denied' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const perm = await requestPermission()
                      setNotifPermission(perm)
                    }}
                    className="self-start rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                  >
                    Benachrichtigungen erlauben
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-racing-800">
                {/* Termine */}
                <div className="flex items-center gap-3 py-3">
                  <CalendarDays size={16} className="flex-shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Termine</p>
                    <p className="text-xs text-gray-400">Erinnerung vor Terminen</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyAppointments}
                    onClick={() => setNotifyAppointments(!notifyAppointments)}
                    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${notifyAppointments ? 'bg-[#34c759]' : 'bg-gray-200 dark:bg-racing-700'}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifyAppointments ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                {notifyAppointments && (
                  <div className="flex items-center gap-3 py-3 pl-7">
                    <p className="min-w-0 flex-1 text-xs text-gray-500">Wie viele Minuten vorher?</p>
                    <select
                      value={appointmentReminderMinutes}
                      onChange={(e) => setAppointmentReminderMinutes(Number(e.target.value))}
                      className="rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-xs focus:border-accent focus:outline-none dark:border-racing-700"
                    >
                      {[5, 10, 15, 30, 60].map((m) => (
                        <option key={m} value={m}>{m} Minuten</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Chat */}
                <div className="flex items-center gap-3 py-3">
                  <MessageCircle size={16} className="flex-shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Chat</p>
                    <p className="text-xs text-gray-400">Neue Nachrichten</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyChat}
                    onClick={() => setNotifyChat(!notifyChat)}
                    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${notifyChat ? 'bg-[#34c759]' : 'bg-gray-200 dark:bg-racing-700'}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifyChat ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                {/* Tasks */}
                <div className="flex items-center gap-3 py-3">
                  <Clock size={16} className="flex-shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Aufgaben</p>
                    <p className="text-xs text-gray-400">Neue zugewiesene Aufgaben</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifyTasks}
                    onClick={() => setNotifyTasks(!notifyTasks)}
                    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${notifyTasks ? 'bg-[#34c759]' : 'bg-gray-200 dark:bg-racing-700'}`}
                  >
                    <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${notifyTasks ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Wetter-Standort */}
          <WeatherCitySettings />
        </div>
      )}

      {activeTab === 'profil' && (<>

      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold">{t('profile.avatarTitle')}</h2>
          {profile.id === '6e6370e8-4dfc-4226-b5d5-8bcb6b9273f1' && (
            <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
              👑 Owner
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={t('profile.avatarAlt')} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: profile.avatar_color }}
            >
              {profile.display_name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="flex items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-60 dark:bg-racing-800 dark:text-racing-100"
              >
                <Upload size={14} />
                {uploadingAvatar ? t('profile.uploading') : t('profile.uploadImage')}
              </button>
              {profile.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                >
                  {t('profile.remove')}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleAvatarFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {!profile.avatar_url && (
              <div className="flex flex-wrap gap-2">
                {BOARD_COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => handleColorChange(c)}
                    className={`h-6 w-6 rounded-full border-2 ${profile.avatar_color === c ? 'border-gray-900 dark:border-white' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        {avatarError && <p className="mt-2 text-sm text-red-500">{avatarError}</p>}
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <h2 className="mb-1 text-sm font-semibold">{t('language.title')}</h2>
        <p className="mb-3 text-xs text-gray-400">{t('language.description')}</p>
        <div className="flex gap-2">
          {(['de', 'en'] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setLanguage(lng)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${language === lng ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800'}`}
            >
              {lng === 'de' ? t('language.german') : t('language.english')}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleProfileSubmit}
        className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900"
      >
        <h2 className="text-sm font-semibold">{t('profile.title')}</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('profile.displayName')}</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('profile.username')}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('profile.birthday')}</label>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Berufsbezeichnung</label>
          <input
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="z.B. Marketing Manager"
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Arbeitsstandort</label>
          <input
            value={workLocation}
            onChange={(e) => setWorkLocation(e.target.value)}
            placeholder="z.B. Berlin, Remote"
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('profile.email')}</label>
          <input
            disabled
            value={user.email ?? ''}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm text-gray-400 dark:border-racing-700"
          />
        </div>
        {profileError && <p className="text-sm text-red-500">{profileError}</p>}
        {profileSuccess && <p className="text-sm text-emerald-500">{profileSuccess}</p>}
        <button
          type="submit"
          disabled={savingProfile}
          className="mt-1 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {savingProfile ? t('profile.saving') : t('common:buttons.save')}
        </button>
      </form>

      <form
        onSubmit={handlePasswordSubmit}
        className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900"
      >
        <h2 className="text-sm font-semibold">{t('password.title')}</h2>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('password.new')}</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 pr-9 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? t('password.hide') : t('password.show')}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-400">{t('password.hint')}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('password.confirm')}</label>
          <input
            type={showPassword ? 'text' : 'password'}
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
        {passwordSuccess && <p className="text-sm text-emerald-500">{passwordSuccess}</p>}
        <button
          type="submit"
          disabled={savingPassword}
          className="mt-1 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {savingPassword ? t('password.saving') : t('password.submit')}
        </button>
      </form>
      </>)}

      {activeTab === 'datenschutz' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <h2 className="mb-1 text-sm font-semibold">{t('privacy.exportTitle')}</h2>
            <p className="mb-3 text-xs text-gray-400">
              {t('privacy.exportDescription')}
            </p>
            {exportError && <p className="mb-2 text-sm text-red-500">{exportError}</p>}
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting ? t('privacy.exporting') : t('privacy.exportButton')}
            </button>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <h2 className="mb-1 text-sm font-semibold">{t('privacy.appInfoTitle')}</h2>
            <p className="mb-2 text-xs text-gray-400">{t('privacy.appInfoVersion', { version: __APP_VERSION__ })}</p>
            <div className="flex flex-col gap-1 text-xs">
              <Link to="/datenschutz" target="_blank" className="text-accent hover:underline">{t('privacy.privacyPolicyLink')}</Link>
              <Link to="/impressum" target="_blank" className="text-accent hover:underline">{t('privacy.imprintLink')}</Link>
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-900/10">
            <h2 className="mb-1 text-sm font-semibold text-red-600 dark:text-red-400">{t('privacy.deleteTitle')}</h2>
            <p className="mb-3 text-xs text-red-500/80 dark:text-red-300/70">
              {t('privacy.deleteDescription')}
            </p>
            <label className="mb-1 block text-xs font-medium text-red-600 dark:text-red-400">
              {t('privacy.deleteConfirmLabel').split('%WORD%')[0]}
              <span className="font-mono">{t('privacy.deleteConfirmWord')}</span>
              {t('privacy.deleteConfirmLabel').split('%WORD%')[1]}
            </label>
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="mb-3 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm focus:border-red-400 focus:outline-none dark:border-red-900/40 dark:bg-racing-900"
            />
            {deleteError && <p className="mb-2 text-sm text-red-500">{deleteError}</p>}
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== t('privacy.deleteConfirmWord') || deleting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {deleting ? t('privacy.deleting') : t('privacy.deleteButton')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'arbeitszeit' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <h2 className="mb-1 text-sm font-semibold">Abteilungsprofile / Department Profiles</h2>
            <p className="mb-4 text-xs text-gray-400">Arbeitszeitregelungen für verschiedene Abteilungen — aktiviertes Profil wird für alle Berechnungen verwendet.</p>
            <div className="flex flex-col gap-2">
              {workProfiles.map((p) => (
                <div key={p.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${activeProfileId === p.id ? 'border-accent bg-accent/5' : 'border-gray-200 dark:border-racing-700'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {p.weeklyHours}h Vertrag · {p.workDaysPerWeek} Tage
                      {p.weekdayHours != null ? ` · Mo–Do ${p.weekdayHours}h` : ''}
                      {p.fridayHours != null ? ` · Fr ${p.fridayHours}h` : ''}
                      · Pause {p.defaultBreakMinutes} Min.
                    </p>
                  </div>
                  <button
                    onClick={() => applyWorkProfile(p.id)}
                    className={`flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${activeProfileId === p.id ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-racing-800 dark:text-racing-200'}`}
                  >
                    {activeProfileId === p.id ? '✓ Aktiv' : 'Anwenden'}
                  </button>
                  {p.id !== 'gbm' && profile.is_admin && (
                    <button onClick={() => deleteWorkProfile(p.id)} className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              {profile.is_admin && !showAddProfile && (
                <button
                  onClick={() => setShowAddProfile(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400 hover:border-accent hover:text-accent dark:border-racing-700"
                >
                  <Plus size={14} /> Neues Profil anlegen / New profile
                </button>
              )}
              {profile.is_admin && showAddProfile && (
                <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                  <p className="text-xs font-semibold text-accent">Neues Profil</p>
                  <input
                    placeholder="Name (z.B. IT-Abteilung / Finance)"
                    value={newProfile.name}
                    onChange={(e) => setNewProfile((p) => ({ ...p, name: e.target.value }))}
                    className="rounded-lg border border-gray-200 bg-transparent px-3 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-xs text-gray-400">Vertragsstunden/Woche</label>
                      <input type="number" min={1} step={0.5} value={newProfile.weeklyHours}
                        onChange={(e) => setNewProfile((p) => ({ ...p, weeklyHours: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-gray-400">Arbeitstage/Woche</label>
                      <input type="number" min={1} max={7} value={newProfile.workDaysPerWeek}
                        onChange={(e) => setNewProfile((p) => ({ ...p, workDaysPerWeek: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-gray-400">Mo–Do Stunden</label>
                      <input type="number" min={0} step={0.25} placeholder="= Vertrag/Tage"
                        value={newProfile.weekdayHours ?? ''}
                        onChange={(e) => setNewProfile((p) => ({ ...p, weekdayHours: e.target.value === '' ? undefined : Number(e.target.value) }))}
                        className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-xs text-gray-400">Freitag Stunden</label>
                      <input type="number" min={0} step={0.25} placeholder="= Mo–Do"
                        value={newProfile.fridayHours ?? ''}
                        onChange={(e) => setNewProfile((p) => ({ ...p, fridayHours: e.target.value === '' ? undefined : Number(e.target.value) }))}
                        className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                    </div>
                    <div className="col-span-2">
                      <label className="mb-0.5 block text-xs text-gray-400">Mittagspause (Min.)</label>
                      <input type="number" min={0} step={5} value={newProfile.defaultBreakMinutes}
                        onChange={(e) => setNewProfile((p) => ({ ...p, defaultBreakMinutes: Number(e.target.value) }))}
                        className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (newProfile.name.trim()) { addWorkProfile(newProfile); setNewProfile({ name: '', weeklyHours: 38.5, workDaysPerWeek: 5, defaultBreakMinutes: 45 }); setShowAddProfile(false) } }}
                      disabled={!newProfile.name.trim()}
                      className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Speichern
                    </button>
                    <button onClick={() => setShowAddProfile(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 dark:border-racing-700">
                      Abbrechen
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tastenkuerzel' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
            <h2 className="mb-4 text-sm font-semibold">Tastenkürzel / Keyboard Shortcuts</h2>
            <div className="flex flex-col gap-3">
              {SHORTCUTS.map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm">{s.description}</p>
                    <p className="text-xs text-gray-400">{s.scope}</p>
                  </div>
                  <kbd className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold dark:border-racing-700 dark:bg-racing-800">
                    {s.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
