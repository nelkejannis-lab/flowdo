import { useState } from 'react'
import { Home, Building2, X } from 'lucide-react'
import { useOfficeStore, OfficeLocation } from '../../store/officeStore'

export default function OfficePromptModal() {
  const shouldShow = useOfficeStore((s) => s.shouldShowPrompt)
  const dismissPrompt = useOfficeStore((s) => s.dismissPrompt)
  const setLocation = useOfficeStore((s) => s.setLocation)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  if (!shouldShow()) return null

  async function choose(loc: OfficeLocation) {
    setSaving(true)
    await setLocation(loc, note || undefined)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-racing-900">
        <button
          onClick={dismissPrompt}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X size={16} />
        </button>

        <h2 className="mb-1 text-base font-bold text-gray-800 dark:text-racing-100">
          Wo arbeitest du heute?
        </h2>
        <p className="mb-5 text-xs text-gray-400">Where are you working today?</p>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => choose('homeoffice')}
            disabled={saving}
            className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-transparent bg-blue-50 py-5 text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 disabled:opacity-50 dark:bg-blue-900/20 dark:text-blue-300"
          >
            <Home size={28} />
            <span className="text-sm font-semibold">Homeoffice</span>
          </button>
          <button
            onClick={() => choose('office')}
            disabled={saving}
            className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-transparent bg-indigo-50 py-5 text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-900/20 dark:text-indigo-300"
          >
            <Building2 size={28} />
            <span className="text-sm font-semibold">Büro</span>
          </button>
        </div>

        <input
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 dark:border-racing-700 dark:bg-racing-800 dark:text-racing-100"
          placeholder="Notiz (optional) / Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />
      </div>
    </div>
  )
}
