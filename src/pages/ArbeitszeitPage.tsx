import { useState } from 'react'
import { Settings } from 'lucide-react'
import TimeClock from '../components/worktime/TimeClock'
import OvertimeOverview from '../components/worktime/OvertimeOverview'
import WorkWeekView from '../components/worktime/WorkWeekView'
import WorkMonthView from '../components/worktime/WorkMonthView'
import Modal from '../components/layout/Modal'
import { useWorkTimeStore } from '../store/workTimeStore'

function WorkTimeSettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useWorkTimeStore((s) => s.settings)
  const updateSettings = useWorkTimeStore((s) => s.updateSettings)

  return (
    <Modal title="Arbeitszeit-Einstellungen" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Wochenarbeitszeit (Stunden)</label>
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
          <label className="mb-1 block text-xs font-medium text-gray-500">Arbeitstage pro Woche</label>
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
          <label className="mb-1 block text-xs font-medium text-gray-500">Standard-Mittagspause (Min.)</label>
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
          Fertig
        </button>
      </div>
    </Modal>
  )
}

export default function ArbeitszeitPage() {
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = useState<'week' | 'month'>('week')

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Arbeitszeit</h1>
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
                {v === 'week' ? 'Woche' : 'Monat'}
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
