import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Mic, Square, Maximize2, Minimize2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLiveMeetingStore } from '../../store/liveMeetingStore'
import LiveMeetingPanel from './LiveMeetingPanel'

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * App-shell host so live meetings survive route changes.
 * Shows a floating bar when minimized; expanded modal overlay when open.
 */
export default function LiveMeetingHost() {
  const { t } = useTranslation('meetings')
  const location = useLocation()
  const navigate = useNavigate()
  const isRecording = useLiveMeetingStore((s) => s.isRecording)
  const summary = useLiveMeetingStore((s) => s.summary)
  const transcript = useLiveMeetingStore((s) => s.transcript)
  const recordingStartedAt = useLiveMeetingStore((s) => s.recordingStartedAt)
  const panelExpanded = useLiveMeetingStore((s) => s.panelExpanded)
  const setPanelExpanded = useLiveMeetingStore((s) => s.setPanelExpanded)
  const stopRecording = useLiveMeetingStore((s) => s.stopRecording)
  const [elapsedMs, setElapsedMs] = useState(0)

  const hasSession = isRecording || Boolean(summary || transcript)
  const onMeetingsPage = location.pathname.startsWith('/meetings')

  useEffect(() => {
    if (!isRecording || !recordingStartedAt) {
      setElapsedMs(0)
      return
    }
    const tick = () => setElapsedMs(Date.now() - recordingStartedAt)
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isRecording, recordingStartedAt])

  if (!hasSession) return null

  function handleSaveComplete() {
    setPanelExpanded(false)
    if (onMeetingsPage) navigate('/meetings')
  }

  if (onMeetingsPage && panelExpanded) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-racing-900 p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('liveMeetingTitle')}</h2>
          <button
            type="button"
            onClick={() => setPanelExpanded(false)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800"
          >
            <Minimize2 size={14} />
            {t('live.minimize')}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <LiveMeetingPanel onSaveComplete={handleSaveComplete} />
        </div>
      </div>
    )
  }

  if (panelExpanded && !onMeetingsPage) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-white dark:bg-racing-900 p-4 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('liveMeetingTitle')}</h2>
          <button
            type="button"
            onClick={() => setPanelExpanded(false)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-racing-800"
          >
            <Minimize2 size={14} />
            {t('live.minimize')}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          <LiveMeetingPanel onSaveComplete={handleSaveComplete} />
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-[max(5.5rem,calc(4.5rem+env(safe-area-inset-bottom)))] left-4 right-4 z-50 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm">
      <div className="flex items-center gap-3 rounded-2xl border border-red-200/80 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-md dark:border-red-900/40 dark:bg-racing-900/95">
        <Mic className={`flex-shrink-0 text-red-500 ${isRecording ? 'animate-pulse' : ''}`} size={18} />
        <button
          type="button"
          onClick={() => setPanelExpanded(true)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-semibold">{t('liveMeetingTitle')}</p>
          {isRecording && (
            <p className="font-mono text-xs tabular-nums text-red-500">{formatElapsed(elapsedMs)}</p>
          )}
        </button>
        {isRecording ? (
          <button
            type="button"
            onClick={stopRecording}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-red-500 text-white"
            title={t('live.stopRecording')}
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setPanelExpanded(true)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-accent text-white"
            title={t('live.expand')}
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
