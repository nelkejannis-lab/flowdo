import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import TimeClock from '../components/worktime/TimeClock'
import OvertimeOverview from '../components/worktime/OvertimeOverview'
import WorkWeekView from '../components/worktime/WorkWeekView'
import WorkMonthView from '../components/worktime/WorkMonthView'
import Modal from '../components/layout/Modal'
import { useWorkTimeStore } from '../store/workTimeStore'
import { isSupabaseConfigured } from '../lib/supabase'

function WorkTimeSettingsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('worktime')
  const settings = useWorkTimeStore((s) => s.settings)
  const updateSettings = useWorkTimeStore((s) => s.updateSettings)

  return (
    <Modal title={t('settingsModal.title')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-gray-400">Abteilungsprofile findest du unter Einstellungen → Arbeitszeit.</p>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('settingsModal.weeklyHours')} (Vertrag)</label>
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
          <label className="mb-1 block text-xs font-medium text-gray-500">Mo–Do Regelarbeitszeit (h)</label>
          <input type="number" min={0} step={0.25} placeholder="= Vertrag/Tage"
            value={settings.weekdayHours ?? ''}
            onChange={(e) => updateSettings({ weekdayHours: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Freitag Regelarbeitszeit (h)</label>
          <input type="number" min={0} step={0.25} placeholder="= Mo–Do"
            value={settings.fridayHours ?? ''}
            onChange={(e) => updateSettings({ fridayHours: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('settingsModal.defaultBreakMinutes')}</label>
          <input type="number" min={0} step={5} value={settings.defaultBreakMinutes}
            onChange={(e) => updateSettings({ defaultBreakMinutes: Math.max(0, Number(e.target.value)) })}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
        </div>
        <button onClick={onClose} className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark">
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
  const subscribeToWorkTime = useWorkTimeStore((s) => s.subscribeToWorkTime)

  useEffect(() => {
    if (isSupabaseConfigured) fetchAll()
  }, [fetchAll])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    return subscribeToWorkTime()
  }, [subscribeToWorkTime])

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
