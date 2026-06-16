import { useState } from 'react'
import { Bell, MapPin, CheckCircle2, ChevronRight, X } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'
import { requestPermission, canNotify } from '../../utils/notifications'

type Step = 'notifications' | 'location' | 'done'

export default function OnboardingPermissions() {
  const setDone = useSettingsStore((s) => s.setOnboardingPermissionsDone)
  const [step, setStep] = useState<Step>('notifications')
  const [notifStatus, setNotifStatus] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [locStatus, setLocStatus] = useState<'idle' | 'granted' | 'denied'>('idle')
  const [requesting, setRequesting] = useState(false)

  async function handleNotif() {
    if (!canNotify()) { setNotifStatus('denied'); setStep('location'); return }
    setRequesting(true)
    const perm = await requestPermission()
    setRequesting(false)
    setNotifStatus(perm === 'granted' ? 'granted' : 'denied')
    setTimeout(() => setStep('location'), 600)
  }

  function skipNotif() {
    setNotifStatus('denied')
    setStep('location')
  }

  async function handleLocation() {
    if (!navigator.geolocation) { setLocStatus('denied'); setStep('done'); return }
    setRequesting(true)
    navigator.geolocation.getCurrentPosition(
      () => { setRequesting(false); setLocStatus('granted'); setTimeout(() => setStep('done'), 600) },
      () => { setRequesting(false); setLocStatus('denied'); setTimeout(() => setStep('done'), 400) },
      { timeout: 10000 }
    )
  }

  function skipLocation() {
    setLocStatus('denied')
    setStep('done')
  }

  if (step === 'done') {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          className="relative z-10 w-full max-w-sm rounded-2xl p-6 text-center sm:rounded-2xl"
          style={{ background: 'rgba(18,18,18,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="mb-4 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#34c759]/15">
              <CheckCircle2 size={36} className="text-[#34c759]" />
            </span>
          </div>
          <h2 className="mb-1 text-lg font-bold text-white">Alles bereit</h2>
          <p className="mb-6 text-sm text-white/50">Du kannst die Einstellungen jederzeit unter Funktionen anpassen.</p>
          <button
            onClick={setDone}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-80"
            style={{ background: 'linear-gradient(135deg, #1a1a1a, #2d2d2d)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            Los geht's
          </button>
        </div>
      </div>
    )
  }

  const isNotif = step === 'notifications'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-t-3xl p-6 sm:rounded-2xl"
        style={{ background: 'rgba(18,18,18,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Progress dots */}
        <div className="mb-6 flex justify-center gap-1.5">
          <span className={`h-1.5 w-6 rounded-full transition-colors ${isNotif ? 'bg-white' : 'bg-[#34c759]'}`} />
          <span className={`h-1.5 w-6 rounded-full transition-colors ${!isNotif ? 'bg-white' : 'bg-white/20'}`} />
        </div>

        <div className="mb-5 flex justify-center">
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: isNotif ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.07)' }}
          >
            {isNotif
              ? <Bell size={38} className="text-white" strokeWidth={1.5} />
              : <MapPin size={38} className="text-white" strokeWidth={1.5} />
            }
          </span>
        </div>

        <h2 className="mb-2 text-center text-xl font-bold text-white">
          {isNotif ? 'Benachrichtigungen' : 'Standort'}
        </h2>
        <p className="mb-8 text-center text-sm leading-relaxed text-white/50">
          {isNotif
            ? 'Erhalte Erinnerungen für Termine, Aufgaben und Nachrichten – direkt auf deinem Gerät.'
            : 'Für das Wetter auf deinem Dashboard wird dein aktueller Standort benötigt. Keine Daten werden gespeichert.'
          }
        </p>

        <button
          onClick={isNotif ? handleNotif : handleLocation}
          disabled={requesting}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #1e1e1e, #2a2a2a)', border: '1px solid rgba(255,255,255,0.14)' }}
        >
          {requesting
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            : isNotif
              ? (notifStatus === 'granted' ? <CheckCircle2 size={16} className="text-[#34c759]" /> : <Bell size={16} />)
              : (locStatus === 'granted' ? <CheckCircle2 size={16} className="text-[#34c759]" /> : <MapPin size={16} />)
          }
          {requesting
            ? 'Warte...'
            : isNotif ? 'Benachrichtigungen erlauben' : 'Standort freigeben'
          }
          {!requesting && <ChevronRight size={15} className="ml-auto opacity-40" />}
        </button>

        <button
          onClick={isNotif ? skipNotif : skipLocation}
          disabled={requesting}
          className="w-full rounded-xl py-2.5 text-sm text-white/40 transition-colors hover:text-white/60 disabled:opacity-40"
        >
          Überspringen
        </button>
      </div>
    </div>
  )
}
