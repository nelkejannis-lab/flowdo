import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Settings, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import TimeClock from '../components/worktime/TimeClock'
import OvertimeOverview from '../components/worktime/OvertimeOverview'
import WorkWeekView from '../components/worktime/WorkWeekView'
import WorkMonthView from '../components/worktime/WorkMonthView'
import Modal from '../components/layout/Modal'
import { useWorkTimeStore } from '../store/workTimeStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { todayISO } from '../utils/date'

function WorkTimeSettingsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('worktime')
  const settings = useWorkTimeStore((s) => s.settings)
  const updateSettings = useWorkTimeStore((s) => s.updateSettings)

  return (
    <Modal title={t('settingsModal.title')} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('settingsModal.weeklyHours')}</label>
          <input
            type="number"
            min={1}
            step={0.5}
            value={settings.weeklyHours}
            onChange={(e) => updateSettings({ weeklyHours: Math.max(0, Number(e.target.value)) })}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('settingsModal.workDaysPerWeek')}</label>
          <input
            type="number"
            min={1}
            max={7}
            value={settings.workDaysPerWeek}
            onChange={(e) => updateSettings({ workDaysPerWeek: Math.max(1, Number(e.target.value)) })}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('settingsModal.defaultBreakMinutes')}</label>
          <input
            type="number"
            min={0}
            step={5}
            value={settings.defaultBreakMinutes}
            onChange={(e) => updateSettings({ defaultBreakMinutes: Math.max(0, Number(e.target.value)) })}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <button
          onClick={onClose}
          className="mt-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          {t('settingsModal.done')}
        </button>
      </div>
    </Modal>
  )
}

export default function ArbeitszeitPage() {
  const { t, i18n } = useTranslation('worktime')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = useState<'week' | 'month'>('week')
  const [newCompDate, setNewCompDate] = useState(todayISO())
  const [newCompNote, setNewCompNote] = useState('')
  const fetchAll = useWorkTimeStore((s) => s.fetchAll)
  const compensationDays = useWorkTimeStore((s) => s.compensationDays)
  const addCompensationDay = useWorkTimeStore((s) => s.addCompensationDay)
  const removeCompensationDay = useWorkTimeStore((s) => s.removeCompensationDay)

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

      {/* Ausgleichstage */}
      <div className="mt-6 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <h2 className="mb-3 text-sm font-semibold">Ausgleichstage</h2>
        <div className="mb-3 flex gap-2">
          <input
            type="date"
            value={newCompDate}
            onChange={(e) => setNewCompDate(e.target.value)}
            className="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
          <input
            type="text"
            value={newCompNote}
            onChange={(e) => setNewCompNote(e.target.value)}
            placeholder="Notiz (optional)"
            className="flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
          <button
            onClick={() => {
              if (!newCompDate) return
              addCompensationDay(newCompDate, newCompNote.trim())
              setNewCompNote('')
            }}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            <Plus size={14} />
            Hinzufügen
          </button>
        </div>
        {compensationDays.length === 0 ? (
          <p className="text-sm text-gray-400">Noch keine Ausgleichstage eingetragen.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-racing-800">
            {compensationDays.map((d) => (
              <div key={d.date} className="flex items-center gap-3 py-2">
                <span className="text-sm font-medium">
                  {format(parseISO(d.date), 'EEE, d. MMM yyyy', { locale: dateLocale })}
                </span>
                {d.note && <span className="flex-1 text-sm text-gray-400">{d.note}</span>}
                {!d.note && <span className="flex-1" />}
                <button
                  onClick={() => removeCompensationDay(d.date)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSettings && <WorkTimeSettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}
