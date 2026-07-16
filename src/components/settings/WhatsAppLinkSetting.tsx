import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Copy, Loader2, MessageCircle, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import {
  apiGenerateWhatsAppLinkCode,
  apiGetWhatsAppLinkStatus,
  apiUnlinkWhatsAppNumber,
  novaApiAvailable,
  type WhatsAppLinkStatusResult,
} from '../../lib/novaApi'

export default function WhatsAppLinkSetting() {
  const { t, i18n } = useTranslation('settings')
  const fetchProfile = useAuthStore((s) => s.fetchProfile)
  const [state, setState] = useState<WhatsAppLinkStatusResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    setMessage(null)
    const result = await apiGetWhatsAppLinkStatus()
    setState(result)
    setLoading(false)
    if (result.error) setMessage(result.error)
  }

  useEffect(() => {
    void reload()
  }, [])

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
    await fetchProfile()
    await reload()
  }

  async function copyCode() {
    if (!state?.linkCode) return
    try {
      await navigator.clipboard.writeText(state.linkCode)
      setMessage(t('whatsapp.copied'))
    } catch {
      // ignore clipboard restrictions
    }
  }

  if (!novaApiAvailable()) {
    return (
      <p className="text-xs text-gray-400">{t('whatsapp.serverUnavailable')}</p>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin text-accent" />
        <span>{t('whatsapp.loading')}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <MessageCircle size={20} className="mt-0.5 flex-shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{t('whatsapp.statusTitle')}</p>
          <p className="mt-1 text-xs text-gray-400">
            {state?.linked
              ? t('whatsapp.linked', { phone: state.linkedPhone || '—' })
              : t('whatsapp.notLinked', { bot: state?.botNumber ? ` (${state.botNumber})` : '' })}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-racing-800 dark:bg-racing-950/40">
        <p className="mb-2 text-xs font-medium text-gray-500">{t('whatsapp.codeLabel')}</p>
        {state?.linkCode ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold tracking-wider text-accent dark:border-racing-700 dark:bg-racing-900">
              {state.linkCode}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-white dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800"
            >
              <Copy size={12} />
              {t('whatsapp.copy')}
            </button>
            <button
              type="button"
              onClick={generateCode}
              disabled={busy}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {t('whatsapp.refreshCode')}
            </button>
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
          {state?.linkCode ? t('whatsapp.sendHint') : t('whatsapp.noCode')}
          {state?.linkCodeExpiresAt
            ? ` ${t('whatsapp.expiresAt')}: ${new Date(state.linkCodeExpiresAt).toLocaleString(i18n.language === 'en' ? 'en-US' : 'de-DE')}.`
            : ''}
          {typeof state?.remainingAttempts === 'number'
            ? ` ${t('whatsapp.attemptsLeft')}: ${state.remainingAttempts}.`
            : ''}
        </p>
      </div>

      {state?.linked && (
        <button
          type="button"
          onClick={unlink}
          disabled={busy}
          className="self-start rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          {t('whatsapp.unlink')}
        </button>
      )}

      {state?.sandboxMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">{t('whatsapp.sandboxTitle')}</p>
          <p className="mt-1">{t('whatsapp.sandboxHint')}</p>
          {state.sandboxJoinCode && (
            <p className="mt-2 font-mono text-amber-900 dark:text-amber-100">{state.sandboxJoinCode}</p>
          )}
        </div>
      )}

      {message && (
        <div className="flex items-center gap-2 text-xs">
          <span className={state?.error ? 'text-red-500' : 'text-gray-500'}>{message}</span>
          <button type="button" onClick={reload} className="font-medium text-accent hover:underline">
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
