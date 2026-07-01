import { useState } from 'react'
import { Bell, CheckCircle2, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../../store/settingsStore'
import { requestPermission, canNotify } from '../../utils/notifications'

export default function OnboardingPermissions() {
  const { t } = useTranslation('layout')
  const setDone = useSettingsStore((s) => s.setOnboardingPermissionsDone)
  const [requesting, setRequesting] = useState(false)
  const [granted, setGranted] = useState(false)

  async function handleNotif() {
    if (!canNotify()) { setDone(); return }
    setRequesting(true)
    const perm = await requestPermission()
    setRequesting(false)
    if (perm === 'granted') setGranted(true)
    setTimeout(() => setDone(), 600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-sm rounded-t-3xl p-6 sm:rounded-2xl"
        style={{ background: 'rgba(18,18,18,0.95)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="mb-5 flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
            {granted
              ? <CheckCircle2 size={38} className="text-[#34c759]" />
              : <Bell size={38} className="text-white" strokeWidth={1.5} />}
          </span>
        </div>

        <h2 className="mb-2 text-center text-xl font-bold text-white">{t('onboardingPermissions.title')}</h2>
        <p className="mb-8 text-center text-sm leading-relaxed text-white/50">
          {t('onboardingPermissions.description')}
        </p>

        <button
          onClick={handleNotif}
          disabled={requesting}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #1e1e1e, #2a2a2a)', border: '1px solid rgba(255,255,255,0.14)' }}
        >
          {requesting
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            : granted
              ? <CheckCircle2 size={16} className="text-[#34c759]" />
              : <Bell size={16} />}
          {requesting ? t('onboardingPermissions.waiting') : t('onboardingPermissions.allow')}
          {!requesting && <ChevronRight size={15} className="ml-auto opacity-40" />}
        </button>

        <button
          onClick={setDone}
          disabled={requesting}
          className="w-full rounded-xl py-2.5 text-sm text-white/40 transition-colors hover:text-white/60 disabled:opacity-40"
        >
          {t('onboardingPermissions.skip')}
        </button>
      </div>
    </div>
  )
}
