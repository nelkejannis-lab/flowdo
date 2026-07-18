import { useEffect, useState } from 'react'
import { BookOpen, Copy, ExternalLink, Loader2, MessageCircle, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { de, enUS } from 'date-fns/locale'
import { useBrainStore } from '../../store/brainStore'
import { useMemoryStore } from '../../store/memoryStore'
import { todayISO } from '../../utils/date'
import {
  apiGetWhatsAppLinkStatus,
  composeWhatsAppConnectText,
  whatsappDeepLink,
  type WhatsAppLinkStatusResult,
} from '../../lib/novaApi'

interface Props {
  onClose: () => void
  onSaved?: () => void
}

export function saveJournalToBrain(text: string, dateISO = todayISO()) {
  const brain = useBrainStore.getState()
  const memory = useMemoryStore.getState()
  const columnId = brain.ensureColumn('journal', 'Journal')
  const title = `Journal ${dateISO}`
  const content = text.trim()
  brain.addPage(columnId, title, content)
  const page = useBrainStore
    .getState()
    .pages.find((p) => p.columnId === columnId && p.title === title && p.content === content)
  if (page) {
    brain.updatePage(page.id, { tags: ['journal', 'abendreflexion'] })
  }
  const mem = memory.addMemory({
    text: content,
    source: 'manual',
    tags: ['journal', dateISO],
    linkedBrainPageId: page?.id,
  })
  return { pageId: page?.id, memoryId: mem.id }
}

export default function JournalModal({ onClose, onSaved }: Props) {
  const { t, i18n } = useTranslation('dashboard')
  const dateLocale = i18n.language === 'en' ? enUS : de
  const today = todayISO()
  const dayLabel = format(new Date(), 'EEEE, d. MMMM', { locale: dateLocale })
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [waStatus, setWaStatus] = useState<WhatsAppLinkStatusResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void apiGetWhatsAppLinkStatus().then(setWaStatus).catch(() => setWaStatus(null))
  }, [])

  function handleSave() {
    const trimmed = text.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      saveJournalToBrain(trimmed, today)
      setSaved(true)
      localStorage.setItem('journalDismissed', today)
      onSaved?.()
      setTimeout(onClose, 700)
    } finally {
      setSaving(false)
    }
  }

  const linked = !!waStatus?.linked
  const sandbox = waStatus?.sandboxMode !== false
  const bot = waStatus?.botNumber || '+14155238886'
  const joinCode = waStatus?.sandboxJoinCode
  const prefill = linked
    ? `journal ${text.trim() || '…'}`
    : composeWhatsAppConnectText({
        linkCode: waStatus?.linkCode || 'NOVAT-XXXXXX',
        joinCode: joinCode,
        includeJoin: sandbox,
      })
  const deepLink = whatsappDeepLink(linked ? 'journal ' : prefill, bot)

  async function copyPrefill() {
    try {
      await navigator.clipboard.writeText(linked ? 'journal ' : prefill)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 backdrop-blur-[3px] sm:items-center sm:p-6">
      <div className="bento-card relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden dark:shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="relative overflow-hidden px-5 pb-3 pt-5 sm:px-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent" />
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('journalDismissed', today)
              onClose()
            }}
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-gray-400 hover:bg-black/[0.05] dark:hover:bg-white/10"
            aria-label={t('journal.close')}
          >
            <X size={16} />
          </button>
          <div className="relative flex items-start gap-3 pr-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
              <BookOpen size={22} strokeWidth={1.6} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-500 dark:text-racing-300">{t('journal.eyebrow')}</p>
              <h2 className="text-xl font-semibold tracking-tight">{t('journal.title')}</h2>
              <p className="mt-0.5 text-xs text-gray-400">{dayLabel}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-2 sm:px-6">
          <p className="text-sm text-gray-500 dark:text-racing-300">{t('journal.subtitle')}</p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder={t('journal.placeholder')}
            className="w-full resize-none rounded-2xl border border-gray-200 bg-black/[0.02] px-3.5 py-3 text-sm leading-relaxed focus:border-accent focus:outline-none dark:border-racing-700 dark:bg-white/[0.03]"
            autoFocus
          />

          <div className="rounded-2xl border border-dashed border-gray-200 p-3 dark:border-racing-700">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-racing-200">
              <MessageCircle size={14} className="text-accent" />
              {t('journal.whatsappHint')}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              {linked ? t('journal.whatsappLinked') : t('journal.whatsappUnlinked')}
            </p>
            {sandbox && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                {t('journal.sandboxNote')}
                {joinCode ? ` (${joinCode})` : ''}
              </p>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a
                href={deepLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20"
              >
                <ExternalLink size={12} />
                {t('journal.openWhatsApp')}
              </a>
              <button
                type="button"
                onClick={copyPrefill}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-racing-700 dark:text-racing-200"
              >
                <Copy size={12} />
                {copied ? t('journal.copied') : t('journal.copy')}
              </button>
            </div>
          </div>
        </div>

        <div className="border-t border-black/[0.05] p-4 dark:border-white/[0.06] sm:p-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={!text.trim() || saving || saved}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-semibold text-white shadow-sm shadow-accent/25 hover:brightness-110 disabled:opacity-40"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : null}
            {saved ? t('journal.saved') : t('journal.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
