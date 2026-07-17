import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Bookmark,
  Film,
  Heart,
  Image as ImageIcon,
  Instagram,
  LayoutGrid,
  Lightbulb,
  MessageCircle,
  Plus,
  RefreshCw,
  Share2,
  TrendingUp,
  Users,
  Eye,
  ExternalLink,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSocialStore } from '../store/socialStore'
import AddSocialAccountModal from '../components/social/AddSocialAccountModal'
import Sparkline from '../components/social/Sparkline'
import { formatFriendlyDateTime } from '../utils/date'
import {
  computeSocialDashboard,
  DAY_LABELS,
  fmtCompact,
  fmtPct,
  isFebiAccount,
  pickPrimaryAccount,
  type SocialPeriod,
} from '../lib/socialInsights'
import type { SocialAccount, SocialPost } from '../types'

const IG_APP_ID = '1960989051209185'
const IG_REDIRECT_URI = 'https://novat.app/instagram-callback'
const IG_SCOPES = 'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish'

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
  color,
  height = 120,
}: {
  data: { date: string; value: number }[]
  color: string
  height?: number
}) {
  if (data.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center text-xs text-gray-400">
        Noch zu wenig Zeitreihen-Daten — synchronisiere über mehrere Tage.
      </div>
    )
  }
  const w = 480
  const h = height
  const pad = { t: 8, r: 8, b: 22, l: 36 }
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
  const gradId = `social-area-${color.replace('#', '')}`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} role="img" aria-label="Zeitreihe">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[min, min + range / 2, max].map((v) => (
        <g key={v}>
          <line x1={pad.l} y1={yOf(v)} x2={w - pad.r} y2={yOf(v)} stroke="currentColor" strokeOpacity="0.08" />
          <text x={pad.l - 4} y={yOf(v) + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.45">
            {fmtCompact(Math.round(v))}
          </text>
        </g>
      ))}
      {data
        .filter((_, i) => i % xStep === 0 || i === data.length - 1)
        .map((d) => {
          const i = data.indexOf(d)
          return (
            <text key={d.date} x={xOf(i)} y={h - 4} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.4">
              {d.date.slice(5)}
            </text>
          )
        })}
      <path d={area} fill={`url(#${gradId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-gray-100 dark:bg-racing-800 ${className ?? ''}`} />
}

function KpiTile({
  label,
  value,
  sub,
  icon,
  spark,
  color,
}: {
  label: string
  value: string
  sub?: string
  icon: ReactNode
  spark?: number[]
  color?: string
}) {
  return (
    <div className="bento-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
          <span className="text-accent">{icon}</span>
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white sm:text-3xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      {spark && spark.length >= 2 && (
        <div className="mt-3">
          <Sparkline values={spark} color={color ?? 'rgb(var(--accent))'} width={160} height={36} />
        </div>
      )}
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
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-gray-200 text-gray-600 hover:border-accent/40 dark:border-racing-700 dark:text-racing-200'
      }`}
    >
      {account.profilePictureUrl ? (
        <img src={account.profilePictureUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-yellow-400 text-[10px] text-white">
          @
        </span>
      )}
      <span className="max-w-[140px] truncate">@{account.username}</span>
      {febi && (
        <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
          FEBI
        </span>
      )}
    </button>
  )
}

function TopPostRow({ post, rank, followers }: { post: SocialPost; rank: number; followers: number }) {
  const eng =
    followers > 0 ? ((post.likeCount ?? 0) + (post.commentsCount ?? 0)) / followers * 100 : null
  const typeIcon =
    post.mediaType === 'VIDEO' ? (
      <Film size={12} />
    ) : post.mediaType === 'CAROUSEL_ALBUM' ? (
      <LayoutGrid size={12} />
    ) : (
      <ImageIcon size={12} />
    )

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <span className="w-5 text-xs font-bold text-accent">#{rank}</span>
      {(post.thumbnailUrl || post.mediaUrl) && (
        <img
          src={post.thumbnailUrl ?? post.mediaUrl}
          alt=""
          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800 dark:text-racing-100">
          {post.caption?.slice(0, 60) || 'Ohne Caption'}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center gap-1">
            {typeIcon}
            {post.mediaType === 'VIDEO' ? 'Reel' : post.mediaType === 'CAROUSEL_ALBUM' ? 'Karussell' : 'Bild'}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart size={11} /> {fmtCompact(post.likeCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={11} /> {fmtCompact(post.commentsCount)}
          </span>
          {eng != null && <span>{fmtPct(eng)} ER</span>}
        </p>
      </div>
      {post.permalink && (
        <a
          href={post.permalink}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-accent dark:hover:bg-racing-800"
          title="Auf Instagram öffnen"
        >
          <ExternalLink size={14} />
        </a>
      )}
    </div>
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [bootstrapped, setBootstrapped] = useState(false)

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
    )
  }, [activeAccount, metrics, posts, period])

  const showSkeleton = (!bootstrapped && loading) || (accounts.length > 0 && dataLoading && !dashboard?.hasSyncedData)

  async function handleSync(accountId: string) {
    setSyncError(null)
    const err = await syncAccount(accountId)
    if (err) setSyncError(err)
  }

  const reachSpark = dashboard?.reachSeries.map((d) => d.value) ?? []
  const engSpark = dashboard?.engagementSeries.map((d) => d.value) ?? []

  return (
    <div className="pb-10">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Insights</p>
          <h1 className="mt-0.5 flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white">
            <BarChart3 size={22} className="text-accent" />
            {t('page.title')}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-gray-500">
            {activeAccount && isFebiAccount(activeAccount)
              ? 'Performance & Handlungsempfehlungen für FEBI Bilstein (@febi.bilstein) — basierend auf verbundenen Instagram-Daten.'
              : 'Übersicht, Trends und umsetzbare Tipps für deine verbundenen Instagram-Accounts.'}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm font-medium dark:bg-racing-800">
            {([
              ['today', 'Heute'],
              ['week', 'Woche'],
              ['month', 'Monat'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPeriod(key)}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  period === key ? 'bg-white shadow-sm dark:bg-racing-700' : 'text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {dashboard && (
            <p className="text-xs text-gray-400">
              {dashboard.startISO} – {dashboard.endISO}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={buildInstagramOAuthUrl()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <Instagram size={16} />
              Mit Instagram verbinden
            </a>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
            >
              <Plus size={16} />
              Manuell
            </button>
          </div>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {syncError && (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Sync fehlgeschlagen</p>
          <p className="mt-1">{syncError}</p>
        </div>
      )}

      {/* Empty state */}
      {bootstrapped && accounts.length === 0 && (
        <div className="bento-card flex flex-col items-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/20">
            <Instagram size={28} className="text-pink-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kein Account verbunden</h2>
          <p className="mt-2 max-w-md text-sm text-gray-500">{t('page.emptyState')}</p>
          <p className="mt-2 max-w-md text-xs text-gray-400">
            Für FEBI Bilstein: Instagram Business/Creator mit Meta verbinden — dann erscheinen Follower, Reichweite und Insights hier.
          </p>
          <a
            href={buildInstagramOAuthUrl()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-accent-dark"
          >
            <Instagram size={16} />
            Instagram verbinden
          </a>
        </div>
      )}

      {/* Skeleton */}
      {showSkeleton && accounts.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-28" />
            ))}
          </div>
          <SkeletonBlock className="h-56" />
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonBlock className="h-64" />
            <SkeletonBlock className="h-64" />
          </div>
        </div>
      )}

      {/* Dashboard */}
      {activeAccount && dashboard && !showSkeleton && (
        <>
          {/* Account switcher */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {accounts.map((a) => (
              <AccountChip
                key={a.id}
                account={a}
                active={a.id === activeAccount.id}
                onClick={() => setSelectedId(a.id)}
              />
            ))}
            <button
              type="button"
              onClick={() => handleSync(activeAccount.id)}
              disabled={syncingId === activeAccount.id || !activeAccount.tokenConfigured}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800"
            >
              <RefreshCw size={14} className={syncingId === activeAccount.id ? 'animate-spin' : ''} />
              {syncingId === activeAccount.id ? 'Synchronisiere…' : 'Sync'}
            </button>
            <Link
              to={`/social/${activeAccount.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent/20"
            >
              Detailansicht
            </Link>
          </div>

          {/* Profile strip */}
          <div className="bento-card mb-4 flex flex-wrap items-center gap-4 p-4">
            {activeAccount.profilePictureUrl ? (
              <img
                src={activeAccount.profilePictureUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-accent/25"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 text-xl font-bold text-white">
                @
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">@{activeAccount.username}</h2>
                {isFebiAccount(activeAccount) && (
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                    FEBI Bilstein
                  </span>
                )}
              </div>
              {activeAccount.name && <p className="text-sm text-gray-500">{activeAccount.name}</p>}
              <p className="text-xs text-gray-400">
                {activeAccount.lastSyncedAt
                  ? `Zuletzt synchronisiert: ${formatFriendlyDateTime(activeAccount.lastSyncedAt)}`
                  : 'Noch nicht synchronisiert'}
                {!activeAccount.tokenConfigured && ' · Token fehlt'}
              </p>
            </div>
            {!dashboard.hasSyncedData && activeAccount.tokenConfigured && (
              <button
                type="button"
                onClick={() => handleSync(activeAccount.id)}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
              >
                Jetzt synchronisieren
              </button>
            )}
          </div>

          {!dashboard.hasSyncedData ? (
            <div className="bento-card px-6 py-12 text-center">
              <p className="font-medium text-gray-700 dark:text-racing-200">Noch keine Metriken geladen</p>
              <p className="mt-1 text-sm text-gray-500">
                Synchronisiere den Account, um KPIs, Charts und Insights zu sehen. Es werden keine Demo-Zahlen angezeigt.
              </p>
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
                <KpiTile
                  label="Follower"
                  value={fmtCompact(dashboard.kpis.followers)}
                  icon={<Users size={14} />}
                  spark={(metrics[activeAccount.id] ?? []).map((m) => m.followersCount ?? 0).filter((v) => v > 0)}
                  color="#6366f1"
                />
                <KpiTile
                  label="Reichweite"
                  value={fmtCompact(dashboard.kpis.reach)}
                  sub="Summe im Zeitraum"
                  icon={<TrendingUp size={14} />}
                  spark={reachSpark}
                  color="#10b981"
                />
                <KpiTile
                  label="Engagement"
                  value={fmtPct(dashboard.kpis.engagementRate)}
                  sub={
                    dashboard.kpis.engagementBasis === 'reach'
                      ? 'Interaktionen / Reichweite'
                      : dashboard.kpis.engagementBasis === 'followers'
                        ? 'Ø pro Post / Follower'
                        : undefined
                  }
                  icon={<Heart size={14} />}
                  spark={engSpark}
                  color="#f43f5e"
                />
                <KpiTile
                  label="Posts"
                  value={String(dashboard.kpis.postsInPeriod)}
                  sub="im Zeitraum"
                  icon={<LayoutGrid size={14} />}
                />
                <KpiTile
                  label="Profilaufrufe"
                  value={fmtCompact(dashboard.kpis.profileViews)}
                  sub={`Interaktionen ${fmtCompact(dashboard.kpis.interactions)}`}
                  icon={<Eye size={14} />}
                  color="#f59e0b"
                />
              </div>

              {/* Secondary metrics */}
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Likes', value: dashboard.kpis.likes, icon: <Heart size={13} className="text-rose-400" /> },
                  { label: 'Kommentare', value: dashboard.kpis.comments, icon: <MessageCircle size={13} className="text-blue-400" /> },
                  { label: 'Saves', value: dashboard.kpis.saves, icon: <Bookmark size={13} className="text-amber-500" /> },
                  { label: 'Shares', value: dashboard.kpis.shares, icon: <Share2 size={13} className="text-violet-400" /> },
                ].map((m) => (
                  <div key={m.label} className="bento-card-sm flex items-center gap-3 p-3">
                    {m.icon}
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{m.label}</p>
                      <p className="text-lg font-bold tabular-nums">{fmtCompact(m.value)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Charts + mix */}
              <div className="mb-4 grid gap-4 lg:grid-cols-5">
                <div className="bento-card p-5 lg:col-span-3">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Engagement über Zeit</h3>
                    <span className="text-xs text-gray-400">Interaktionen / Tag</span>
                  </div>
                  <AreaChart data={dashboard.engagementSeries} color="#f43f5e" />
                </div>
                <div className="bento-card p-5 lg:col-span-2">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Content-Mix</h3>
                  {dashboard.contentMix.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">Keine Posts im Zeitraum.</p>
                  ) : (
                    <div className="space-y-3">
                      {dashboard.contentMix.map((slice) => {
                        const max = Math.max(...dashboard.contentMix.map((s) => s.count), 1)
                        return (
                          <div key={slice.key}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                              <span className="font-medium">{slice.label}</span>
                              <span className="text-xs text-gray-500">
                                {slice.count} · {fmtPct(slice.avgEngagement)} ER
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-racing-700">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${(slice.count / max) * 100}%`, backgroundColor: slice.color }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {(dashboard.bestDay != null || dashboard.bestHour != null) && (
                    <div className="mt-4 rounded-xl bg-accent/5 px-3 py-2 text-xs text-gray-600 dark:text-racing-300">
                      Beste Slot:{' '}
                      <strong>
                        {dashboard.bestDay != null ? DAY_LABELS[dashboard.bestDay] : '–'}
                        {dashboard.bestHour != null ? ` · ${dashboard.bestHour}:00` : ''}
                      </strong>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4 grid gap-4 lg:grid-cols-2">
                {/* Top posts */}
                <div className="bento-card p-5">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Beste Posts im Zeitraum</h3>
                  {dashboard.topPosts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">Keine Posts in diesem Zeitraum.</p>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-racing-800">
                      {dashboard.topPosts.map((p, i) => (
                        <TopPostRow
                          key={p.id}
                          post={p}
                          rank={i + 1}
                          followers={dashboard.kpis.followers ?? 0}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Insights */}
                <div className="bento-card p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Lightbulb size={16} className="text-accent" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Insights & Empfehlungen</h3>
                  </div>
                  <ul className="space-y-3">
                    {dashboard.insights.map((tip) => (
                      <li
                        key={tip.id}
                        className={`rounded-xl px-3 py-2.5 text-sm ${
                          tip.tone === 'positive'
                            ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200'
                            : tip.tone === 'action'
                              ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200'
                              : 'bg-gray-50 text-gray-700 dark:bg-racing-800 dark:text-racing-200'
                        }`}
                      >
                        <p className="font-semibold">{tip.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed opacity-90">{tip.body}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-[10px] leading-relaxed text-gray-400">
                    Hinweis: Meta liefert Account-Insights (Reichweite, Profilaufrufe, Interaktionen) und Post-Metriken
                    nur mit gültigem Token und Berechtigung <code className="font-mono">instagram_business_manage_insights</code>.
                    Impressionen auf Account-Ebene sind in der aktuellen Instagram API weitgehend durch Reichweite ersetzt.
                    Story-Daten nur ~24h. Keine erfundenen Demo-Zahlen.
                  </p>
                </div>
              </div>

              {/* Reach chart */}
              {dashboard.reachSeries.length >= 2 && (
                <div className="bento-card mb-4 p-5">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">Reichweite über Zeit</h3>
                  <AreaChart data={dashboard.reachSeries} color="#10b981" />
                </div>
              )}
            </>
          )}

          {/* Account cards */}
          <div className="mt-2">
            <h3 className="mb-3 text-sm font-semibold text-gray-500">Alle Accounts</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.map((account) => {
                const latest = metrics[account.id]?.[metrics[account.id].length - 1]
                const acctPosts = posts[account.id] ?? []
                return (
                  <Link
                    key={account.id}
                    to={`/social/${account.id}`}
                    className={`bento-card-sm flex flex-col gap-3 p-4 transition hover:ring-2 hover:ring-accent/30 ${
                      account.id === activeAccount.id ? 'ring-2 ring-accent/40' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {account.profilePictureUrl ? (
                        <img
                          src={account.profilePictureUrl}
                          alt=""
                          className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 text-white">
                          <Instagram size={18} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate font-bold">@{account.username}</h4>
                        <p className="text-xs text-gray-400">
                          {account.lastSyncedAt
                            ? formatFriendlyDateTime(account.lastSyncedAt)
                            : 'Noch nicht synchronisiert'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault()
                          handleSync(account.id)
                        }}
                        disabled={syncingId === account.id}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-accent dark:hover:bg-racing-800 disabled:opacity-60"
                        title="Synchronisieren"
                      >
                        <RefreshCw size={15} className={syncingId === account.id ? 'animate-spin' : ''} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-gray-50 p-2 dark:bg-racing-800">
                        <p className="text-[10px] text-gray-400">Follower</p>
                        <p className="text-sm font-bold">{fmtCompact(latest?.followersCount)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-2 dark:bg-racing-800">
                        <p className="text-[10px] text-gray-400">Reichweite</p>
                        <p className="text-sm font-bold">{fmtCompact(latest?.reach)}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-2 dark:bg-racing-800">
                        <p className="text-[10px] text-gray-400">Posts</p>
                        <p className="text-sm font-bold">{acctPosts.length || '–'}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      {showForm && <AddSocialAccountModal onClose={() => setShowForm(false)} />}
    </div>
  )
}
