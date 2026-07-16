import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CheckCircle2, Copy, ExternalLink, Loader2, MessageCircle, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import {
  apiGenerateWhatsAppLinkCode,
  apiGetWhatsAppLinkStatus,
  apiUnlinkWhatsAppNumber,
  normalizeSandboxJoin,
  novaApiAvailable,
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
  const [state, setState] = useState<WhatsAppLinkStatusResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [step1Done, setStep1Done] = useState(false)

  async function reload(silent = false) {
    if (!silent) {
      setLoading(true)
      setMessage(null)
    }
    const result = await apiGetWhatsAppLinkStatus()
    setState(result)
    if (!silent) setLoading(false)
    if (result.error) setMessage(result.error)
    if (result.linked) setStep1Done(true)
  }

  useEffect(() => {
    void reload()
  }, [])

  // Poll while waiting for the user to send the NOVAT code via WhatsApp.
  useEffect(() => {
    if (!state?.linkCode || state.linked) return
    const id = window.setInterval(() => {
      void reload(true)
    }, 5000)
    return () => window.clearInterval(id)
  }, [state?.linkCode, state?.linked])

  async function generateCode() {
    setBusy(true)
    setMessage(null)
    const result = await apiGenerateWhatsAppLinkCode()
    setBusy(false)
    setState(result)
    if (result.error) setMessage(result.error)
    else setMessage(null)
  }

  async function unlink() {
    setBusy(true)
    setMessage(null)
    const result = await apiUnlinkWhatsAppNumber()
    setBusy(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    setStep1Done(false)
    await fetchProfile()
    await reload()
  }

  async function copyText(text: string, okKey: string) {
    try {
      await navigator.clipboard.writeText(text)
      setMessage(t(okKey))
    } catch {
      // ignore clipboard restrictions
    }
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
  const joinCode = normalizeSandboxJoin(state?.sandboxJoinCode)
  const linkCode = state?.linkCode || null
  const sandboxOn = state?.sandboxMode !== false

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <MessageCircle size={20} className="mt-0.5 flex-shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t('whatsapp.statusTitle')}</p>
          <p className="mt-1 text-xs text-gray-400">
            {state?.linked
              ? t('whatsapp.linked', { phone: state.linkedPhone || '—' })
              : t('whatsapp.notLinked', { bot: botLabel ? ` (${botLabel})` : '' })}
          </p>
        </div>
        {state?.linked && (
          <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0 text-emerald-500" />
        )}
      </div>

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
              <p className="mt-2 text-xs text-amber-900 dark:text-amber-100">
                {t('whatsapp.botNumberLabel')}:{' '}
                <span className="font-mono font-semibold">{botLabel}</span>
              </p>

              {joinCode ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <code className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-semibold tracking-wide text-amber-950 dark:border-amber-800 dark:bg-racing-950 dark:text-amber-100">
                    {joinCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => void copyText(joinCode, 'whatsapp.copiedJoin')}
                    className="flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-white dark:border-amber-800 dark:text-amber-100 dark:hover:bg-racing-900"
                  >
                    <Copy size={12} />
                    {t('whatsapp.copy')}
                  </button>
                  <a
                    href={whatsappDeepLink(joinCode, state?.botNumber)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                  >
                    <ExternalLink size={12} />
                    {t('whatsapp.openWhatsApp')}
                  </a>
                </div>
              ) : (
                <div className="mt-3 space-y-2 text-xs text-amber-900 dark:text-amber-100">
                  <p>{t('whatsapp.joinMissing')}</p>
                  <a
                    href={whatsappDeepLink('join ', state?.botNumber)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                  >
                    <ExternalLink size={12} />
                    {t('whatsapp.openWhatsAppJoin')}
                  </a>
                </div>
              )}
              <p className="mt-2 text-[11px] text-amber-800/70 dark:text-amber-200/60">{t('whatsapp.sandboxExpiry')}</p>
            </div>
          )}

          {/* Step 2 — NOVAT-Code */}
          <div
            className={`rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-racing-800 dark:bg-racing-950/40 ${
              sandboxOn && !step1Done ? 'opacity-60' : ''
            }`}
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('whatsapp.step2Title')}
            </p>
            <p className="mb-3 text-xs text-gray-400">{t('whatsapp.step2Hint')}</p>

            {linkCode ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold tracking-wider text-accent dark:border-racing-700 dark:bg-racing-900">
                  {linkCode}
                </code>
                <button
                  type="button"
                  onClick={() => void copyText(linkCode, 'whatsapp.copied')}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800"
                >
                  <Copy size={12} />
                  {t('whatsapp.copy')}
                </button>
                <a
                  href={whatsappDeepLink(linkCode, state?.botNumber)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                >
                  <ExternalLink size={12} />
                  {t('whatsapp.openWhatsApp')}
                </a>
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
            ) : (
              <button
                type="button"
                onClick={generateCode}
                disabled={busy || (sandboxOn && !step1Done)}
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
              {typeof state?.remainingAttempts === 'number'
                ? ` ${t('whatsapp.attemptsLeft')}: ${state.remainingAttempts}.`
                : ''}
            </p>
            {linkCode && (
              <p className="mt-1 text-[11px] text-gray-400">{t('whatsapp.waitingLink')}</p>
            )}
          </div>
        </>
      )}

      {message && (
        <div className="flex items-center gap-2 text-xs">
          <span className={state?.error ? 'text-red-500' : 'text-gray-500'}>{message}</span>
          <button type="button" onClick={() => void reload()} className="font-medium text-accent hover:underline">
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
