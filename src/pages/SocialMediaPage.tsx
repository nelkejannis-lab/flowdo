import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfMonth } from 'date-fns'
import {
  BarChart3,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Film,
  Heart,
  Image as ImageIcon,
  Instagram,
  LayoutGrid,
  MessageCircle,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSocialStore } from '../store/socialStore'
import AddSocialAccountModal from '../components/social/AddSocialAccountModal'
import { formatFriendlyDateTime } from '../utils/date'
import {
  buildPostInsight,
  canGoNextMonth,
  computeSocialDashboard,
  DAY_LABELS,
  fmtCompact,
  fmtPct,
  suggestNextContent,
  isFebiAccount,
  META_INSIGHTS_MAX_DAYS,
  monthLabel,
  pickPrimaryAccount,
  scoreTone,
  shiftMonthAnchor,
  type PeriodBenchmarks,
  type SocialPeriod,
} from '../lib/socialInsights'
import PostInsightAnalysis from '../components/social/PostInsightAnalysis'
import type { SocialAccount, SocialPost } from '../types'

const IG_APP_ID = '1960989051209185'
const IG_REDIRECT_URI = 'https://novat.app/instagram-callback'
const IG_SCOPES = 'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish'
const ACCENT = 'rgb(var(--accent))'

function ScoreBadge({
  score,
  size = 'sm',
}: {
  score: number | null
  size?: 'sm' | 'lg'
}) {
  const tone = scoreTone(score)
  if (tone === 'none' || score == null) return null
  const colors =
    tone === 'high'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
      : tone === 'mid'
        ? 'bg-accent/15 text-accent'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
  const sizing = size === 'lg' ? 'px-2.5 py-1 text-base' : 'px-1.5 py-0.5 text-[11px]'
  return (
    <span
      className={`inline-flex items-baseline gap-0.5 rounded-md font-bold tabular-nums ${colors} ${sizing}`}
      title="Post-Wertung 1–10"
    >
      {score.toFixed(1)}
      <span className={`font-semibold opacity-60 ${size === 'lg' ? 'text-xs' : 'text-[9px]'}`}>/10</span>
    </span>
  )
}

function buildInstagramOAuthUrl() {
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('client_id', IG_APP_ID)
  url.searchParams.set('redirect_uri', IG_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', IG_SCOPES)
  return url.toString()
}

function AreaChart({
  data,
  height = 168,
}: {
  data: { date: string; value: number }[]
  height?: number
}) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center text-sm text-gray-400" style={{ height }}>
        Noch zu wenig Zeitreihen-Daten — über mehrere Tage synchronisieren.
      </div>
    )
  }

  const w = 560
  const h = height
  const pad = { t: 10, r: 12, b: 24, l: 40 }
  const iw = w - pad.l - pad.r
  const ih = h - pad.t - pad.b
  const vals = data.map((d) => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const xOf = (i: number) => pad.l + (i / (data.length - 1)) * iw
  const yOf = (v: number) => pad.t + ih - ((v - min) / range) * ih
  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ')
  const area =
    `M${xOf(0)},${yOf(data[0].value)} ` +
    data.map((d, i) => `L${xOf(i)},${yOf(d.value)}`).join(' ') +
    ` L${xOf(data.length - 1)},${pad.t + ih} L${xOf(0)},${pad.t + ih} Z`
  const xStep = Math.max(1, Math.floor(data.length / 4))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} role="img" aria-label="Zeitreihe">
      <defs>
        <linearGradient id="social-primary-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[min, min + range / 2, max].map((v) => (
        <g key={v}>
          <line x1={pad.l} y1={yOf(v)} x2={w - pad.r} y2={yOf(v)} stroke="currentColor" strokeOpacity="0.06" />
          <text x={pad.l - 6} y={yOf(v) + 3} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.4">
            {fmtCompact(Math.round(v))}
          </text>
        </g>
      ))}
      {data
        .filter((_, i) => i % xStep === 0 || i === data.length - 1)
        .map((d) => {
          const i = data.indexOf(d)
          return (
            <text key={d.date} x={xOf(i)} y={h - 4} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.35">
              {d.date.slice(5)}
            </text>
          )
        })}
      <path d={area} fill="url(#social-primary-area)" />
      <polyline points={pts} fill="none" stroke={ACCENT} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-gray-100 dark:bg-racing-800 ${className ?? ''}`} />
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="bento-card p-4 sm:p-5">
      <p className="text-xs font-medium text-gray-500 dark:text-racing-300">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white sm:text-3xl">
        {value}
      </p>
      {sub && <p className="mt-1 text-xs leading-relaxed text-gray-400">{sub}</p>}
    </div>
  )
}

function AccountChip({
  account,
  active,
  onClick,
}: {
  account: SocialAccount
  active: boolean
  onClick: () => void
}) {
  const febi = isFebiAccount(account)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-accent/40 bg-accent/10 text-accent'
          : 'border-gray-200 text-gray-600 hover:border-accent/30 dark:border-racing-700 dark:text-racing-200'
      }`}
    >
      {account.profilePictureUrl ? (
        <img src={account.profilePictureUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[9px] text-gray-500 dark:bg-racing-700">
          @
        </span>
      )}
      <span className="max-w-[140px] truncate">@{account.username}</span>
      {febi && (
        <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
          FEBI
        </span>
      )}
    </button>
  )
}

function PostInsightModal({
  post,
  followers,
  benchmarks,
  onClose,
}: {
  post: SocialPost
  followers: number
  benchmarks: PeriodBenchmarks
  onClose: () => void
}) {
  const insight = buildPostInsight(post, followers, benchmarks)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-racing-900">
        <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4 dark:border-racing-800">
          {(post.thumbnailUrl || post.mediaUrl) && (
            <img
              src={post.thumbnailUrl ?? post.mediaUrl}
              alt=""
              className="h-14 w-14 flex-shrink-0 rounded-xl object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-medium text-gray-400">{insight.formatLabel}</p>
              <ScoreBadge score={insight.score} size="lg" />
            </div>
            <p className="mt-0.5 line-clamp-2 text-sm font-medium text-gray-900 dark:text-white">
              {post.caption?.slice(0, 120) || 'Ohne Caption'}
            </p>
            {post.postedAt && (
              <p className="mt-1 text-[11px] text-gray-400">{formatFriendlyDateTime(post.postedAt)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-racing-800/80">
              <p className="text-[10px] text-gray-400">Likes</p>
              <p className="text-sm font-semibold tabular-nums">{fmtCompact(post.likeCount)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-racing-800/80">
              <p className="text-[10px] text-gray-400">Kommentare</p>
              <p className="text-sm font-semibold tabular-nums">{fmtCompact(post.commentsCount)}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-racing-800/80">
              <p className="text-[10px] text-gray-400">Saves</p>
              <p className="text-sm font-semibold tabular-nums">{fmtCompact(post.saved)}</p>
            </div>
            {(post.shares != null || post.reach != null) && (
              <>
                <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-racing-800/80">
                  <p className="text-[10px] text-gray-400">Shares</p>
                  <p className="text-sm font-semibold tabular-nums">{fmtCompact(post.shares)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-racing-800/80">
                  <p className="text-[10px] text-gray-400">Reichweite</p>
                  <p className="text-sm font-semibold tabular-nums">{fmtCompact(post.reach)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-racing-800/80">
                  <p className="text-[10px] text-gray-400">Engagement</p>
                  <p className="text-sm font-semibold tabular-nums">{fmtPct(insight.engagementRate)}</p>
                </div>
              </>
            )}
          </div>

          <PostInsightAnalysis insight={insight} />

          {post.permalink && (
            <a
              href={post.permalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
            >
              <ExternalLink size={14} /> Auf Instagram öffnen
            </a>
          )}

        </div>
      </div>
    </div>
  )
}

function TopPostRow({
  post,
  rank,
  followers,
  benchmarks,
  onOpen,
}: {
  post: SocialPost
  rank: number
  followers: number
  benchmarks: PeriodBenchmarks
  onOpen: () => void
}) {
  const insight = buildPostInsight(post, followers, benchmarks)
  const typeIcon =
    post.mediaType === 'VIDEO' ? (
      <Film size={12} />
    ) : post.mediaType === 'CAROUSEL_ALBUM' ? (
      <LayoutGrid size={12} />
    ) : (
      <ImageIcon size={12} />
    )

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-gray-50/80 dark:hover:bg-racing-800/40 -mx-1 rounded-xl px-1"
    >
      <span className="w-4 text-xs font-semibold tabular-nums text-gray-400">{rank}</span>
      {(post.thumbnailUrl || post.mediaUrl) && (
        <img
          src={post.thumbnailUrl ?? post.mediaUrl}
          alt=""
          className="h-11 w-11 flex-shrink-0 rounded-xl object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 dark:text-racing-100">
            {post.caption?.slice(0, 72) || 'Ohne Caption'}
          </p>
          <ScoreBadge score={insight.score} />
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-2.5 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1 text-gray-400">{typeIcon}</span>
          <span className="inline-flex items-center gap-1">
            <Heart size={11} /> {fmtCompact(post.likeCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={11} /> {fmtCompact(post.commentsCount)}
          </span>
          {(post.saved ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Bookmark size={11} /> {fmtCompact(post.saved)}
            </span>
          )}
          {insight.engagementRate != null && (
            <span className="tabular-nums">{fmtPct(insight.engagementRate)}</span>
          )}
        </p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-gray-400">{insight.analysis}</p>
      </div>
    </button>
  )
}

export default function SocialMediaPage() {
  const { t } = useTranslation('social')
  const accounts = useSocialStore((s) => s.accounts)
  const metrics = useSocialStore((s) => s.metrics)
  const posts = useSocialStore((s) => s.posts)
  const loading = useSocialStore((s) => s.loading)
  const dataLoading = useSocialStore((s) => s.dataLoading)
  const fetchAccounts = useSocialStore((s) => s.fetchAccounts)
  const fetchAllAccountData = useSocialStore((s) => s.fetchAllAccountData)
  const syncAccount = useSocialStore((s) => s.syncAccount)
  const syncingId = useSocialStore((s) => s.syncingId)
  const error = useSocialStore((s) => s.error)

  const [period, setPeriod] = useState<SocialPeriod>('week')
  const [monthAnchor, setMonthAnchor] = useState(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)
  const [showKpiHelp, setShowKpiHelp] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await fetchAccounts()
      if (!cancelled) setBootstrapped(true)
    })()
    return () => {
      cancelled = true
    }
  }, [fetchAccounts])

  useEffect(() => {
    if (!accounts.length) return
    void fetchAllAccountData()
  }, [accounts, fetchAllAccountData])

  useEffect(() => {
    if (!accounts.length) {
      setSelectedId(null)
      return
    }
    if (selectedId && accounts.some((a) => a.id === selectedId)) return
    setSelectedId(pickPrimaryAccount(accounts)?.id ?? accounts[0].id)
  }, [accounts, selectedId])

  const orderedAccounts = useMemo(() => {
    const primary = pickPrimaryAccount(accounts)
    if (!primary) return accounts
    return [primary, ...accounts.filter((a) => a.id !== primary.id)]
  }, [accounts])

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === selectedId) ?? pickPrimaryAccount(accounts),
    [accounts, selectedId],
  )

  const dashboard = useMemo(() => {
    if (!activeAccount) return null
    return computeSocialDashboard(
      activeAccount,
      metrics[activeAccount.id] ?? [],
      posts[activeAccount.id] ?? [],
      period,
      {
        from: customFrom || undefined,
        to: customTo || undefined,
        monthAnchor,
      },
    )
  }, [activeAccount, metrics, posts, period, customFrom, customTo, monthAnchor])

  const showSkeleton =
    (!bootstrapped && loading) || (accounts.length > 0 && dataLoading && !dashboard?.hasSyncedData)

  async function handleSync(accountId: string) {
    setSyncError(null)
    const err = await syncAccount(accountId)
    if (err) setSyncError(err)
  }

  function selectPreset(p: 'today' | 'week' | 'month') {
    setPeriod(p)
    setShowCustom(false)
  }

  function selectMonthNav() {
    setPeriod('monthNav')
    setShowCustom(false)
    setMonthAnchor(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  }

  function applyCustomRange() {
    if (!customFrom || !customTo) return
    setPeriod('custom')
    setShowCustom(true)
  }

  const mixTotal = dashboard?.contentMix.reduce((s, m) => s + m.count, 0) ?? 0
  const nextMonthEnabled = canGoNextMonth(monthAnchor)

  const kpiSubs: Record<string, string | undefined> = {
    followers: undefined,
    reach: dashboard?.kpiExplainers.find((e) => e.key === 'reach')?.implication,
    engagement:
      dashboard?.kpis.engagementBasis === 'reach'
        ? 'vs. Reichweite'
        : dashboard?.kpis.engagementBasis === 'followers'
          ? 'vs. Follower'
          : undefined,
    posts: 'im Zeitraum',
    saves:
      dashboard && dashboard.kpis.profileViews > 0
        ? `${fmtCompact(dashboard.kpis.profileViews)} Profilaufrufe`
        : dashboard?.kpiExplainers.find((e) => e.key === 'saves')?.short,
  }

  return (
    <div className="pb-12">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
            <BarChart3 size={22} className="text-accent" />
            {t('page.title')}
          </h1>
          <p className="mt-1 max-w-lg text-sm text-gray-500">
            {activeAccount && isFebiAccount(activeAccount) ? t('page.introFebi') : t('page.intro')}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          {/* Presets */}
          <div className="flex flex-wrap gap-1 self-start rounded-lg bg-gray-100 p-1 text-sm font-medium dark:bg-racing-800 sm:self-end">
            {(
              [
                ['today', t('page.period.today')],
                ['week', t('page.period.week')],
                ['month', t('page.period.month')],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  period === key
                    ? 'bg-white text-gray-900 shadow-sm dark:bg-racing-700 dark:text-white'
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-racing-200'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={selectMonthNav}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                period === 'monthNav'
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-racing-700 dark:text-white'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-racing-200'
              }`}
            >
              {t('page.period.months')}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCustom((v) => !v)
                if (!customFrom || !customTo) {
                  const end = format(new Date(), 'yyyy-MM-dd')
                  const start = format(new Date(Date.now() - 13 * 86_400_000), 'yyyy-MM-dd')
                  setCustomFrom(start)
                  setCustomTo(end)
                }
              }}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                period === 'custom' || showCustom
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-racing-700 dark:text-white'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-racing-200'
              }`}
            >
              {t('page.period.custom')}
            </button>
          </div>

          {/* Month navigation */}
          {period === 'monthNav' && (
            <div className="flex items-center gap-1 self-start sm:self-end">
              <button
                type="button"
                onClick={() => setMonthAnchor((a) => shiftMonthAnchor(a, -1))}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-racing-800"
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="min-w-[7.5rem] text-center text-sm font-medium capitalize text-gray-800 dark:text-racing-100">
                {monthLabel(monthAnchor)}
              </span>
              <button
                type="button"
                onClick={() => nextMonthEnabled && setMonthAnchor((a) => shiftMonthAnchor(a, 1))}
                disabled={!nextMonthEnabled}
                className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-racing-800"
                aria-label="Nächster Monat"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

          {/* Custom range */}
          {showCustom && (
            <div className="flex flex-wrap items-center gap-2 self-start rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-racing-700 dark:bg-racing-900 sm:self-end">
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Von</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-md border border-gray-200 bg-transparent px-2 py-1 text-sm text-gray-800 dark:border-racing-700 dark:text-racing-100"
                />
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                <span>Bis</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-md border border-gray-200 bg-transparent px-2 py-1 text-sm text-gray-800 dark:border-racing-700 dark:text-racing-100"
                />
              </label>
              <button
                type="button"
                onClick={applyCustomRange}
                disabled={!customFrom || !customTo}
                className="rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
              >
                Anwenden
              </button>
            </div>
          )}

          {dashboard && (
            <p className="text-xs text-gray-400">
              {dashboard.rangeLabel}
              {` · ${dashboard.startISO} – ${dashboard.endISO}`}
            </p>
          )}
          {dashboard?.rangeWarning && (
            <p className="max-w-xs text-right text-[11px] text-amber-600 dark:text-amber-400">
              {dashboard.rangeWarning}
            </p>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
      {syncError && (
        <div className="mb-6 rounded-2xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/15 dark:text-red-400">
          <p className="font-medium">Sync fehlgeschlagen</p>
          <p className="mt-1 opacity-90">{syncError}</p>
        </div>
      )}

      {/* Empty state */}
      {bootstrapped && accounts.length === 0 && (
        <div className="bento-card flex flex-col items-center px-6 py-20 text-center">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
            <Instagram size={22} className="text-accent" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kein Account verbunden</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500">{t('page.emptyState')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href={buildInstagramOAuthUrl()}
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-dark"
            >
              <Instagram size={16} />
              Instagram verbinden
            </a>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800"
            >
              <Plus size={16} />
              Manuell
            </button>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {showSkeleton && accounts.length > 0 && (
        <div className="space-y-5">
          <SkeletonBlock className="h-10 w-64" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24" />
            ))}
          </div>
          <SkeletonBlock className="h-56" />
          <div className="grid gap-4 lg:grid-cols-5">
            <SkeletonBlock className="h-64 lg:col-span-3" />
            <SkeletonBlock className="h-64 lg:col-span-2" />
          </div>
        </div>
      )}

      {/* Dashboard */}
      {activeAccount && dashboard && !showSkeleton && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {orderedAccounts.map((a) => (
              <AccountChip
                key={a.id}
                account={a}
                active={a.id === activeAccount.id}
                onClick={() => setSelectedId(a.id)}
              />
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSync(activeAccount.id)}
                disabled={syncingId === activeAccount.id || !activeAccount.tokenConfigured}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800"
              >
                <RefreshCw size={14} className={syncingId === activeAccount.id ? 'animate-spin' : ''} />
                {syncingId === activeAccount.id ? 'Sync…' : 'Sync'}
              </button>
              <Link
                to={`/social/${activeAccount.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent/10"
              >
                Detail
              </Link>
              <a
                href={buildInstagramOAuthUrl()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                title="Weiteren Account verbinden"
              >
                <Plus size={14} />
              </a>
            </div>
          </div>

          <p className="mb-5 text-xs text-gray-400">
            {activeAccount.lastSyncedAt
              ? `Zuletzt synchronisiert ${formatFriendlyDateTime(activeAccount.lastSyncedAt)}`
              : 'Noch nicht synchronisiert'}
            {!activeAccount.tokenConfigured && ' · Token fehlt'}
          </p>

          {!dashboard.hasSyncedData ? (
            <div className="bento-card px-6 py-16 text-center">
              <p className="font-medium text-gray-800 dark:text-racing-100">Noch keine Metriken</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                Synchronisiere den Account, um KPIs und Charts zu sehen. Es werden keine Demo-Zahlen angezeigt.
              </p>
              {activeAccount.tokenConfigured && (
                <button
                  type="button"
                  onClick={() => handleSync(activeAccount.id)}
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark"
                >
                  <RefreshCw size={14} />
                  Jetzt synchronisieren
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Kpi label="Follower" value={fmtCompact(dashboard.kpis.followers)} />
                <Kpi
                  label="Reichweite"
                  value={fmtCompact(dashboard.kpis.reach)}
                  sub={kpiSubs.reach?.slice(0, 90)}
                />
                <Kpi
                  label="Engagement"
                  value={fmtPct(dashboard.kpis.engagementRate)}
                  sub={kpiSubs.engagement}
                />
                <Kpi label="Posts" value={String(dashboard.kpis.postsInPeriod)} sub={kpiSubs.posts} />
                <Kpi label="Saves" value={fmtCompact(dashboard.kpis.saves)} sub={kpiSubs.saves} />
              </div>

              {/* Quiet KPI explanations */}
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowKpiHelp((v) => !v)}
                  className="text-xs font-medium text-gray-400 transition hover:text-accent"
                >
                  {showKpiHelp ? 'Zahlen-Hinweise ausblenden' : 'Was bedeuten die Zahlen?'}
                </button>
                {showKpiHelp && (
                  <ul className="mt-3 space-y-2.5 rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-racing-800 dark:bg-racing-900/50">
                    {dashboard.kpiExplainers.map((ex) => (
                      <li key={ex.key} className="text-xs leading-relaxed text-gray-600 dark:text-racing-300">
                        <span className="font-semibold text-gray-800 dark:text-racing-100">{ex.label}. </span>
                        {ex.short} {ex.implication}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bento-card mb-6 p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {dashboard.primarySeriesKind === 'reach' ? 'Reichweite über Zeit' : 'Engagement über Zeit'}
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {dashboard.primarySeriesKind === 'reach'
                        ? 'Unique Accounts pro Tag'
                        : 'Interaktionen pro Tag'}
                    </p>
                  </div>
                  {(dashboard.bestDay != null || mixTotal > 0) && (
                    <p className="text-xs text-gray-400">
                      {dashboard.bestDay != null && dashboard.bestHour != null && (
                        <span>
                          Bestes Slot: {DAY_LABELS[dashboard.bestDay]} · {dashboard.bestHour}:00
                          {mixTotal > 0 ? ' · ' : ''}
                        </span>
                      )}
                      {mixTotal > 0 && (
                        <span>
                          Mix:{' '}
                          {dashboard.contentMix.map((s) => `${s.label.split(' ')[0]} ${s.count}`).join(' · ')}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <AreaChart data={dashboard.primarySeries} />
              </div>

              {(() => {
                const next = suggestNextContent(dashboard)
                if (!next) return null
                return (
                  <div className="bento-card mb-6 border-l-4 border-l-accent p-5 sm:p-6">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-accent">{next.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-gray-800 dark:text-racing-100">{next.tip}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                      {next.formatLabel && <span>Format: {next.formatLabel}</span>}
                      {next.bestSlot && <span>· Slot: {next.bestSlot}</span>}
                      {next.basedOnScore != null && <span>· Top-Score: {next.basedOnScore}/10</span>}
                    </div>
                  </div>
                )
              })()}

              <div className="grid gap-5 lg:grid-cols-5">
                <div className="bento-card p-5 sm:p-6 lg:col-span-3">
                  <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Beste Posts</h2>
                  <p className="mb-3 text-xs text-gray-400">
                    Nach Engagement · Wertung vs. Periodendurchschnitt — tippen für Analyse
                  </p>
                  {dashboard.topPosts.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-400">Keine Posts in diesem Zeitraum.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-racing-800/80">
                      {dashboard.topPosts.map((p, i) => (
                        <TopPostRow
                          key={p.id}
                          post={p}
                          rank={i + 1}
                          followers={dashboard.kpis.followers ?? 0}
                          benchmarks={dashboard.benchmarks}
                          onOpen={() => setSelectedPost(p)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="bento-card p-5 sm:p-6 lg:col-span-2">
                  <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Insights</h2>
                  {dashboard.insights.length === 0 ? (
                    <p className="text-sm text-gray-400">Noch keine Ableitungen — mehr Sync-Tage helfen.</p>
                  ) : (
                    <ul className="space-y-4">
                      {dashboard.insights.map((tip) => (
                        <li key={tip.id} className="flex gap-3">
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                              tip.tone === 'action'
                                ? 'bg-amber-500'
                                : tip.tone === 'positive'
                                  ? 'bg-emerald-500'
                                  : 'bg-accent/60'
                            }`}
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{tip.title}</p>
                            <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-racing-300">
                              {tip.body}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-6 text-[10px] leading-relaxed text-gray-400">
                    Meta API: Account-Insights ca. {META_INSIGHTS_MAX_DAYS} Tage, Verzögerung bis 48h.
                    Impressionen durch Reach/Views ersetzt. Story-Daten nur ~24h. Keine Demo-Zahlen.
                  </p>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {showForm && <AddSocialAccountModal onClose={() => setShowForm(false)} />}
      {selectedPost && activeAccount && (
        <PostInsightModal
          post={selectedPost}
          followers={dashboard?.kpis.followers ?? 0}
          benchmarks={
            dashboard?.benchmarks ?? {
              postCount: 0,
              avgEngagementRate: null,
              avgReach: null,
              avgSaves: null,
              avgCommentRatio: null,
            }
          }
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  )
}
