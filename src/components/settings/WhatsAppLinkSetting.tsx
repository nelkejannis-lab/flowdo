import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CheckCircle2, Copy, ExternalLink, Loader2, MessageCircle, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import {
  apiGenerateWhatsAppLinkCode,
  apiGetWhatsAppLinkStatus,
  apiSetSandboxJoinCode,
  apiStartWhatsAppPhoneLink,
  apiUnlinkWhatsAppNumber,
  apiVerifyWhatsAppPhoneLink,
  composeWhatsAppConnectText,
  normalizeSandboxJoin,
  novaApiAvailable,
  setLocalSandboxJoinOverride,
  whatsappDeepLink,
  type WhatsAppLinkStatusResult,
} from '../../lib/novaApi'

function formatBotNumber(bot?: string | null): string {
  const digits = (bot || '+14155238886').replace(/\D/g, '')
  if (digits === '14155238886') return '+1 415 523 8886'
  if (bot?.startsWith('+')) return bot
  return bot ? `+${digits}` : '+1 415 523 8886'
}

export default function WhatsAppLinkSetting() {
  const { t, i18n } = useTranslation('settings')
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const profile = useAuthStore((s) => s.profile)
  const isAdmin = !!(profile?.is_admin || profile?.app_role === 'admin')
  const whatsappDailyDigest = useSettingsStore((s) => s.whatsappDailyDigest)
  const morningBriefingTime = useSettingsStore((s) => s.morningBriefingTime)
  const eveningDebriefingTime = useSettingsStore((s) => s.eveningDebriefingTime)
  const setWhatsappDailyDigest = useSettingsStore((s) => s.setWhatsappDailyDigest)
  const setMorningBriefingTime = useSettingsStore((s) => s.setMorningBriefingTime)
  const setEveningDebriefingTime = useSettingsStore((s) => s.setEveningDebriefingTime)

  const [state, setState] = useState<WhatsAppLinkStatusResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [messageOk, setMessageOk] = useState(false)
  const [step1Done, setStep1Done] = useState(false)
  const [joinDraft, setJoinDraft] = useState('')
  const [phoneDraft, setPhoneDraft] = useState('')
  const [otpDraft, setOtpDraft] = useState('')
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null)
  const [mode, setMode] = useState<'code' | 'phone'>('code')
  const wasLinked = useRef(false)

  async function reload(silent = false, forceConnectInfo = false) {
    if (!silent) {
      setLoading(true)
      if (!forceConnectInfo) setMessage(null)
    }
    const result = await apiGetWhatsAppLinkStatus(forceConnectInfo)
    setState(result)
    if (!silent) setLoading(false)
    if (result.error) {
      setMessage(result.error)
      setMessageOk(false)
    }
    if (result.linked) {
      setStep1Done(true)
      if (!wasLinked.current) {
        wasLinked.current = true
        void fetchProfile()
        if (silent) {
          setMessage(t('whatsapp.justLinked', { phone: result.linkedPhone || '—' }))
          setMessageOk(true)
        }
      }
    } else {
      wasLinked.current = false
    }
  }

  useEffect(() => {
    void reload(false, true)
  }, [])

  // Poll while waiting for WhatsApp link (code path or OTP path).
  useEffect(() => {
    if (state?.linked) return
    const waiting = !!(state?.linkCode || otpSentTo)
    if (!waiting) return
    const id = window.setInterval(() => {
      void reload(true)
    }, 2500)
    return () => window.clearInterval(id)
  }, [state?.linkCode, state?.linked, otpSentTo])

  // Refresh when user returns from WhatsApp (tab focus / visibility).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload(true, true)
    }
    const onFocus = () => {
      void reload(true, true)
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pageshow', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pageshow', onVisible)
    }
  }, [])

  async function generateCode() {
    setBusy(true)
    setMessage(null)
    const result = await apiGenerateWhatsAppLinkCode()
    setBusy(false)
    setState(result)
    if (result.error) {
      setMessage(result.error)
      setMessageOk(false)
    } else {
      setMessage(null)
      setMode('code')
    }
  }

  async function unlink() {
    setBusy(true)
    setMessage(null)
    const result = await apiUnlinkWhatsAppNumber()
    setBusy(false)
    if (result.error) {
      setMessage(result.error)
      setMessageOk(false)
      return
    }
    setStep1Done(false)
    setOtpSentTo(null)
    wasLinked.current = false
    await fetchProfile()
    await reload(false, true)
  }

  async function copyText(text: string, okKey: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(t(okKey))
      setMessageOk(true)
    } catch {
      // ignore clipboard restrictions
    }
  }

  async function saveJoinLocally() {
    const normalized = setLocalSandboxJoinOverride(joinDraft)
    if (!normalized) {
      setMessage(t('whatsapp.joinInvalid'))
      setMessageOk(false)
      return
    }
    setJoinDraft(normalized)
    setMessage(t('whatsapp.joinSavedLocal'))
    setMessageOk(true)
    await reload(false, true)
  }

  async function saveJoinAsAdmin() {
    setBusy(true)
    setMessage(null)
    const result = await apiSetSandboxJoinCode(joinDraft)
    setBusy(false)
    if (result.error) {
      setMessage(result.error)
      setMessageOk(false)
      return
    }
    if (result.sandboxJoinCode) setLocalSandboxJoinOverride(result.sandboxJoinCode)
    setMessage(t('whatsapp.joinSavedAdmin'))
    setMessageOk(true)
    await reload(false, true)
  }

  async function sendPhoneOtp() {
    setBusy(true)
    setMessage(null)
    const result = await apiStartWhatsAppPhoneLink(phoneDraft)
    setBusy(false)
    if (result.error) {
      setMessage(result.error)
      setMessageOk(false)
      if (result.needsSandboxJoin) {
        setMode('code')
        setStep1Done(false)
      }
      return
    }
    setOtpSentTo(result.phone || phoneDraft)
    setMessage(t('whatsapp.otpSent', { phone: result.phone || phoneDraft }))
    setMessageOk(true)
  }

  async function verifyPhoneOtp() {
    setBusy(true)
    setMessage(null)
    const result = await apiVerifyWhatsAppPhoneLink(otpDraft)
    setBusy(false)
    if (result.error) {
      setMessage(result.error)
      setMessageOk(false)
      return
    }
    setOtpSentTo(null)
    setOtpDraft('')
    wasLinked.current = false
    await fetchProfile()
    await reload(false, true)
    setMessage(t('whatsapp.justLinked', { phone: result.phone || '—' }))
    setMessageOk(true)
  }

  function openWhatsApp(text: string) {
    // Do not mark step 1 done just by opening WhatsApp — Twilio must reply first.
    window.open(whatsappDeepLink(text, state?.botNumber), '_blank', 'noopener,noreferrer')
    window.setTimeout(() => void reload(true, true), 1500)
  }

  if (!novaApiAvailable()) {
    return <p className="text-xs text-gray-400">{t('whatsapp.serverUnavailable')}</p>
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin text-accent" />
        <span>{t('whatsapp.loading')}</span>
      </div>
    )
  }

  const botLabel = formatBotNumber(state?.botNumber)
  const joinCode = normalizeSandboxJoin(state?.sandboxJoinCode) || normalizeSandboxJoin(joinDraft)
  const linkCode = state?.linkCode || null
  const sandboxOn = state?.sandboxMode !== false
  // Step 1 only → join. Step 2 after join → code. Otherwise combine: join first, then code.
  const includeJoinInStep2 = sandboxOn && !!joinCode && !step1Done
  const step2Message = composeWhatsAppConnectText({
    joinCode,
    linkCode,
    includeJoin: includeJoinInStep2,
  })
  const step1Message = composeWhatsAppConnectText({ joinCode, includeJoin: true })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <MessageCircle size={20} className="mt-0.5 flex-shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t('whatsapp.statusTitle')}</p>
          <p className={`mt-1 text-xs ${state?.linked ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
            {state?.linked
              ? t('whatsapp.linked', { phone: state.linkedPhone || '—' })
              : t('whatsapp.notLinked', { bot: botLabel ? ` (${botLabel})` : '' })}
          </p>
        </div>
        {state?.linked && (
          <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-500" />
        )}
      </div>

      {state?.linked && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-racing-800 dark:bg-racing-950/40">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('whatsapp.digestTitle')}</p>
              <p className="mt-1 text-xs text-gray-500 dark:text-racing-300">{t('whatsapp.digestHint')}</p>
            </div>
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={whatsappDailyDigest}
                onChange={(e) => setWhatsappDailyDigest(e.target.checked)}
                className="rounded border-gray-300 text-accent focus:ring-accent"
              />
              {t('whatsapp.digestToggle')}
            </label>
          </div>
          {whatsappDailyDigest && (
            <div className="mt-3 flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-[11px] text-gray-500 dark:text-racing-300">
                {t('whatsapp.morningTime')}
                <input
                  type="time"
                  value={morningBriefingTime || '07:30'}
                  onChange={(e) => setMorningBriefingTime(e.target.value || '07:30')}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-racing-700 dark:bg-racing-900 dark:text-racing-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-[11px] text-gray-500 dark:text-racing-300">
                {t('whatsapp.eveningTime')}
                <input
                  type="time"
                  value={eveningDebriefingTime || '19:00'}
                  onChange={(e) => setEveningDebriefingTime(e.target.value || '19:00')}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800 dark:border-racing-700 dark:bg-racing-900 dark:text-racing-100"
                />
              </label>
            </div>
          )}
          {sandboxOn && (
            <p className="mt-3 text-[11px] text-amber-800/80 dark:text-amber-200/70">{t('whatsapp.digestSandboxNote')}</p>
          )}
        </div>
      )}

      {state?.linked ? (
        <button
          type="button"
          onClick={unlink}
          disabled={busy}
          className="self-start rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {t('whatsapp.unlink')}
        </button>
      ) : (
        <>
          <p className="text-xs text-gray-500">{t('whatsapp.connectIntro')}</p>

          {sandboxOn && (
            <div className="rounded-lg border border-amber-300/90 bg-amber-100/80 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
              <p className="font-semibold">{t('whatsapp.joinFirstBannerTitle')}</p>
              <p className="mt-1">{t('whatsapp.joinFirstBannerBody', { bot: botLabel })}</p>
              {!joinCode && (
                <p className="mt-1.5 font-medium">{t('whatsapp.joinFirstBannerMissing')}</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('code')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                mode === 'code'
                  ? 'bg-accent text-white'
                  : 'border border-gray-200 text-gray-600 dark:border-racing-700 dark:text-racing-200'
              }`}
            >
              {t('whatsapp.modeCode')}
            </button>
            <button
              type="button"
              onClick={() => setMode('phone')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                mode === 'phone'
                  ? 'bg-accent text-white'
                  : 'border border-gray-200 text-gray-600 dark:border-racing-700 dark:text-racing-200'
              }`}
            >
              {t('whatsapp.modePhone')}
            </button>
          </div>

          {/* Step 1 — Sandbox freischalten */}
          {sandboxOn && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/30">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  {t('whatsapp.step1Title')}
                </p>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={step1Done}
                    onChange={(e) => setStep1Done(e.target.checked)}
                    className="rounded border-amber-400"
                  />
                  {t('whatsapp.step1Done')}
                </label>
              </div>
              <p className="text-xs text-amber-900/80 dark:text-amber-100/80">{t('whatsapp.step1Hint')}</p>
              <div className="mt-3 rounded-lg border border-amber-300/80 bg-white/80 p-3 dark:border-amber-800 dark:bg-racing-950/60">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  {t('whatsapp.doNowTitle')}
                </p>
                <p className="mt-2 text-[11px] text-amber-800/80 dark:text-amber-200/70">
                  {t('whatsapp.doNowNumber')}
                </p>
                <p className="mt-0.5 font-mono text-base font-bold tracking-wide text-amber-950 dark:text-amber-50">
                  {botLabel}
                </p>
                <p className="mt-1 text-[11px] text-amber-800/80 dark:text-amber-200/70">
                  {t('whatsapp.exactNumberHint')}
                </p>
                <button
                  type="button"
                  onClick={() => void copyText(botLabel.replace(/\s/g, '') || '+14155238886', 'whatsapp.copiedNumber')}
                  className="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-white dark:border-amber-800 dark:text-amber-100"
                >
                  <Copy size={12} />
                  {t('whatsapp.copyNumber')}
                </button>
              </div>

              {joinCode ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                    {t('whatsapp.doNowMessage')}
                  </p>
                  <code className="block select-all whitespace-pre-wrap rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-base font-bold tracking-wide text-amber-950 dark:border-amber-800 dark:bg-racing-950 dark:text-amber-100">
                    {step1Message}
                  </code>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-200/70">
                    {t('whatsapp.exactJoinHint', { bot: botLabel })}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(step1Message, 'whatsapp.copiedMessage')}
                      className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                    >
                      <Copy size={12} />
                      {t('whatsapp.copyMessage')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openWhatsApp(step1Message)}
                      className="flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-white dark:border-amber-800 dark:text-amber-100 dark:hover:bg-racing-900"
                    >
                      <ExternalLink size={12} />
                      {t('whatsapp.openWhatsAppPrefill')}
                    </button>
                  </div>
                  <p className="break-all text-[10px] text-amber-800/60 dark:text-amber-200/50">
                    {whatsappDeepLink(step1Message, state?.botNumber)}
                  </p>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-amber-900 dark:text-amber-100">{t('whatsapp.joinMissing')}</p>
                  <p className="text-[11px] font-medium text-amber-900 dark:text-amber-100">{t('whatsapp.joinFailedHint')}</p>
                  <p className="text-[11px] text-amber-800/80 dark:text-amber-200/70">{t('whatsapp.joinMissingAdmin')}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={joinDraft}
                      onChange={(e) => setJoinDraft(e.target.value)}
                      placeholder={t('whatsapp.joinPlaceholder')}
                      className="min-w-[12rem] flex-1 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-mono text-amber-950 dark:border-amber-800 dark:bg-racing-950 dark:text-amber-100"
                    />
                    <button
                      type="button"
                      onClick={() => void saveJoinLocally()}
                      className="rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-white dark:border-amber-800 dark:text-amber-100"
                    >
                      {t('whatsapp.joinSaveLocal')}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void saveJoinAsAdmin()}
                        className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
                      >
                        {t('whatsapp.joinSaveAdmin')}
                      </button>
                    )}
                  </div>
                  {normalizeSandboxJoin(joinDraft) && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-amber-800/80 dark:text-amber-200/70">
                        {t('whatsapp.doNowMessage')}
                      </p>
                      <code className="block select-all rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-bold text-amber-950 dark:border-amber-800 dark:bg-racing-950 dark:text-amber-100">
                        {normalizeSandboxJoin(joinDraft)}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          const text = normalizeSandboxJoin(joinDraft)
                          if (text) openWhatsApp(text)
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                      >
                        <ExternalLink size={12} />
                        {t('whatsapp.openWhatsAppPrefill')}
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 space-y-1 text-[11px] text-amber-800/80 dark:text-amber-200/70">
                <p className="font-semibold text-amber-900 dark:text-amber-100">{t('whatsapp.verifyTitle')}</p>
                <p>{t('whatsapp.verify1')}</p>
                <p>{t('whatsapp.verify2')}</p>
                <p>{t('whatsapp.verify3')}</p>
              </div>
              <p className="mt-2 text-[11px] text-amber-800/70 dark:text-amber-200/60">{t('whatsapp.sandboxExpiry')}</p>
              <p className="mt-1 text-[11px] font-medium text-amber-900 dark:text-amber-100">{t('whatsapp.otpBlockedUntilJoin')}</p>
            </div>
          )}

          {mode === 'code' ? (
            <div
              className={`rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-racing-800 dark:bg-racing-950/40 ${
                sandboxOn && !step1Done ? 'opacity-70' : ''
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('whatsapp.step2Title')}
              </p>
              <p className="mb-3 text-xs text-gray-400">{t('whatsapp.step2Hint')}</p>

              {sandboxOn && !step1Done && (
                <p className="mb-3 text-[11px] text-amber-700 dark:text-amber-300">{t('whatsapp.step1Required')}</p>
              )}

              {linkCode ? (
                <div className="space-y-2">
                  <code className="block select-all whitespace-pre-wrap rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold tracking-wider text-accent dark:border-racing-700 dark:bg-racing-900">
                    {step2Message}
                  </code>
                  {includeJoinInStep2 && (
                    <p className="text-[11px] text-gray-500 dark:text-racing-300">{t('whatsapp.combinedMessageHint')}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void copyText(step2Message, 'whatsapp.copiedMessage')}
                      className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                    >
                      <Copy size={12} />
                      {t('whatsapp.copyMessage')}
                    </button>
                    <button
                      type="button"
                      onClick={() => openWhatsApp(step2Message)}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800"
                    >
                      <ExternalLink size={12} />
                      {t('whatsapp.openWhatsApp')}
                    </button>
                    {includeJoinInStep2 && (
                      <button
                        type="button"
                        onClick={() => void copyText(linkCode, 'whatsapp.copied')}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-white dark:border-racing-700 dark:text-racing-300 dark:hover:bg-racing-800"
                      >
                        <Copy size={12} />
                        {t('whatsapp.copyCodeOnly')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={generateCode}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white disabled:opacity-50 dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800"
                    >
                      {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {t('whatsapp.refreshCode')}
                    </button>
                  </div>
                  <p className="break-all text-[10px] text-gray-400 dark:text-racing-500">
                    {whatsappDeepLink(step2Message, state?.botNumber)}
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={generateCode}
                  disabled={busy}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
                >
                  {busy ? t('whatsapp.generating') : t('whatsapp.generateCode')}
                </button>
              )}

              <p className="mt-3 text-xs text-gray-400">
                {linkCode ? t('whatsapp.sendHint', { bot: botLabel }) : t('whatsapp.noCode')}
                {state?.linkCodeExpiresAt
                  ? ` ${t('whatsapp.expiresAt')}: ${new Date(state.linkCodeExpiresAt).toLocaleString(
                      i18n.language === 'en' ? 'en-US' : 'de-DE',
                    )}.`
                  : ''}
              </p>
              {linkCode && (
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-accent">
                  <Loader2 size={11} className="animate-spin" />
                  {t('whatsapp.waitingLink')}
                </p>
              )}
            </div>
          ) : (
            <div
              className={`rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-racing-800 dark:bg-racing-950/40 ${
                sandboxOn && !step1Done ? 'opacity-70' : ''
              }`}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {t('whatsapp.phoneTitle')}
              </p>
              <p className="mb-3 text-xs text-gray-400">{t('whatsapp.phoneHint')}</p>
              {sandboxOn && !step1Done && (
                <p className="mb-3 text-[11px] text-amber-700 dark:text-amber-300">{t('whatsapp.step1RequiredPhone')}</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="tel"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  placeholder={t('whatsapp.phonePlaceholder')}
                  className="min-w-[12rem] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-racing-700 dark:bg-racing-900"
                />
                <button
                  type="button"
                  disabled={busy || !phoneDraft.trim()}
                  onClick={() => void sendPhoneOtp()}
                  className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
                >
                  {busy ? t('whatsapp.otpSending') : t('whatsapp.otpSend')}
                </button>
              </div>

              {otpSentTo && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otpDraft}
                    onChange={(e) => setOtpDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('whatsapp.otpPlaceholder')}
                    className="w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm tracking-widest dark:border-racing-700 dark:bg-racing-900"
                  />
                  <button
                    type="button"
                    disabled={busy || otpDraft.length < 6}
                    onClick={() => void verifyPhoneOtp()}
                    className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
                  >
                    {t('whatsapp.otpVerify')}
                  </button>
                  <p className="w-full text-[11px] text-accent">
                    <Loader2 size={11} className="mr-1 inline animate-spin" />
                    {t('whatsapp.otpWaiting', { phone: otpSentTo })}
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {message && (
        <div className="flex items-center gap-2 text-xs">
          <span className={messageOk ? 'text-emerald-600 dark:text-emerald-400' : state?.error ? 'text-red-500' : 'text-gray-500'}>
            {message}
          </span>
          <button type="button" onClick={() => void reload(false, true)} className="font-medium text-accent hover:underline">
            {t('whatsapp.retry')}
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400">
        {t('whatsapp.memoryHint')}{' '}
        <Link to="/memory" className="font-medium text-accent hover:underline">
          {t('whatsapp.memoryLink')}
        </Link>
      </p>
    </div>
  )
}
