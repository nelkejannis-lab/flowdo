import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Settings, Trash2 } from 'lucide-react'
import TimeClock from '../components/worktime/TimeClock'
import OvertimeOverview from '../components/worktime/OvertimeOverview'
import WorkWeekView from '../components/worktime/WorkWeekView'
import WorkMonthView from '../components/worktime/WorkMonthView'
import Modal from '../components/layout/Modal'
import { useWorkTimeStore } from '../store/workTimeStore'
import { isSupabaseConfigured } from '../lib/supabase'
import type { WorkProfile } from '../types'

const EMPTY_PROFILE: Omit<WorkProfile, 'id'> = {
  name: '',
  weeklyHours: 38.5,
  workDaysPerWeek: 5,
  defaultBreakMinutes: 45,
  fridayHours: undefined,
}

function WorkTimeSettingsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('worktime')
  const settings = useWorkTimeStore((s) => s.settings)
  const updateSettings = useWorkTimeStore((s) => s.updateSettings)
  const workProfiles = useWorkTimeStore((s) => s.workProfiles)
  const activeProfileId = useWorkTimeStore((s) => s.activeProfileId)
  const applyWorkProfile = useWorkTimeStore((s) => s.applyWorkProfile)
  const addWorkProfile = useWorkTimeStore((s) => s.addWorkProfile)
  const deleteWorkProfile = useWorkTimeStore((s) => s.deleteWorkProfile)

  const [showAddProfile, setShowAddProfile] = useState(false)
  const [newProfile, setNewProfile] = useState<Omit<WorkProfile, 'id'>>(EMPTY_PROFILE)

  function handleAddProfile() {
    if (!newProfile.name.trim()) return
    addWorkProfile(newProfile)
    setNewProfile(EMPTY_PROFILE)
    setShowAddProfile(false)
  }

  return (
    <Modal title={t('settingsModal.title')} onClose={onClose}>
      <div className="flex flex-col gap-4">

        {/* Profile selector */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Abteilungsprofile / Department Profiles</p>
          <div className="flex flex-col gap-2">
            {workProfiles.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${activeProfileId === p.id ? 'border-accent bg-accent/5' : 'border-gray-200 dark:border-racing-700'}`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-gray-400">
                    {p.weeklyHours}h/Woche · {p.workDaysPerWeek} Tage
                    {p.fridayHours != null ? ` · Fr ${p.fridayHours}h` : ''}
                    · Pause {p.defaultBreakMinutes} Min.
                  </p>
                </div>
                <button
                  onClick={() => applyWorkProfile(p.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${activeProfileId === p.id ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-racing-800 dark:text-racing-200'}`}
                >
                  {activeProfileId === p.id ? '✓ Aktiv' : 'Anwenden'}
                </button>
                {p.id !== 'gbm' && (
                  <button onClick={() => deleteWorkProfile(p.id)} className="p-1 text-gray-300 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}

            {!showAddProfile ? (
              <button
                onClick={() => setShowAddProfile(true)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400 hover:border-accent hover:text-accent dark:border-racing-700"
              >
                <Plus size={14} /> Neues Profil / New profile
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
                <p className="text-xs font-semibold text-accent">Neues Profil</p>
                <input
                  placeholder="Name (z.B. IT-Abteilung)"
                  value={newProfile.name}
                  onChange={(e) => setNewProfile((p) => ({ ...p, name: e.target.value }))}
                  className="rounded-lg border border-gray-200 bg-transparent px-3 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-xs text-gray-400">Wochenstunden</label>
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
                    <label className="mb-0.5 block text-xs text-gray-400">Pause (Min.)</label>
                    <input type="number" min={0} step={5} value={newProfile.defaultBreakMinutes}
                      onChange={(e) => setNewProfile((p) => ({ ...p, defaultBreakMinutes: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-xs text-gray-400">Freitag (h, opt.)</label>
                    <input type="number" min={0} step={0.25} placeholder="= Mo-Do"
                      value={newProfile.fridayHours ?? ''}
                      onChange={(e) => setNewProfile((p) => ({ ...p, fridayHours: e.target.value === '' ? undefined : Number(e.target.value) }))}
                      className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddProfile} disabled={!newProfile.name.trim()}
                    className="flex-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                    Speichern
                  </button>
                  <button onClick={() => { setShowAddProfile(false); setNewProfile(EMPTY_PROFILE) }}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 dark:border-racing-700">
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 dark:border-racing-800" />

        {/* Manual settings */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Manuelle Einstellungen / Manual Settings</p>
          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('settingsModal.weeklyHours')}</label>
              <input type="number" min={1} step={0.5} value={settings.weeklyHours}
                onChange={(e) => updateSettings({ weeklyHours: Math.max(0, Number(e.target.value)) })}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('settingsModal.workDaysPerWeek')}</label>
              <input type="number" min={1} max={7} value={settings.workDaysPerWeek}
                onChange={(e) => updateSettings({ workDaysPerWeek: Math.max(1, Number(e.target.value)) })}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('settingsModal.defaultBreakMinutes')}</label>
              <input type="number" min={0} step={5} value={settings.defaultBreakMinutes}
                onChange={(e) => updateSettings({ defaultBreakMinutes: Math.max(0, Number(e.target.value)) })}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Freitag Regelarbeitszeit (h)</label>
              <input type="number" min={0} step={0.25} placeholder="= Mo-Do"
                value={settings.fridayHours ?? ''}
                onChange={(e) => updateSettings({ fridayHours: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
            </div>
          </div>
        </div>

        <button onClick={onClose} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
          {t('settingsModal.done')}
        </button>
      </div>
    </Modal>
  )
}

export default function ArbeitszeitPage() {
  const { t } = useTranslation('worktime')
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = useState<'week' | 'month'>('week')
  const fetchAll = useWorkTimeStore((s) => s.fetchAll)

  useEffect(() => {
    if (isSupabaseConfigured) fetchAll()
  }, [fetchAll])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('page.title')}</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
        >
          <Settings size={18} />
        </button>
      </div>

      <div className="mb-6">
        <OvertimeOverview />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <TimeClock />
        <div>
          <div className="mb-3 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium dark:bg-racing-800 w-fit">
            {(['week', 'month'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  view === v ? 'bg-white shadow-sm dark:bg-racing-700' : 'text-gray-400'
                }`}
              >
                {v === 'week' ? t('page.viewWeek') : t('page.viewMonth')}
              </button>
            ))}
          </div>
          {view === 'week' ? <WorkWeekView /> : <WorkMonthView />}
        </div>
      </div>

      {showSettings && <WorkTimeSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
