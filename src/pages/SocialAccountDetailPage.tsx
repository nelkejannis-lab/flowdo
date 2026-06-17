import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bookmark, Eye, Film, Heart, Image as ImageIcon,
  Link2, MessageCircle, RefreshCw, Repeat2, Share2, Trash2,
  TrendingUp, Users, X, ExternalLink, AlertTriangle, LayoutGrid,
} from 'lucide-react'
import { useSocialStore } from '../store/socialStore'
import type { SocialPost } from '../types'
import { formatFriendlyDateTime } from '../utils/date'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined) {
  if (n === undefined || n === null) return '–'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('de-DE')
}

function pct(n: number | undefined) {
  if (n === undefined) return '–'
  return n.toFixed(2) + '%'
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ values, color = '#6366f1' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const w = 120, h = 40
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Follower Growth Chart ─────────────────────────────────────────────────────

function GrowthChart({ data }: { data: { date: string; followers: number }[] }) {
  if (data.length < 2) return <p className="py-4 text-center text-sm text-gray-400">Noch zu wenig Daten für einen Chart.</p>
  const w = 600, h = 160, pad = { top: 10, right: 20, bottom: 30, left: 55 }
  const iw = w - pad.left - pad.right
  const ih = h - pad.top - pad.bottom
  const vals = data.map((d) => d.followers)
  const min = Math.min(...vals), max = Math.max(...vals)
  const range = max - min || 1
  const xOf = (i: number) => pad.left + (i / (data.length - 1)) * iw
  const yOf = (v: number) => pad.top + ih - ((v - min) / range) * ih
  const pts = data.map((d, i) => `${xOf(i)},${yOf(d.followers)}`).join(' ')
  const area = `M${xOf(0)},${yOf(data[0].followers)} ` + data.map((d, i) => `L${xOf(i)},${yOf(d.followers)}`).join(' ') + ` L${xOf(data.length - 1)},${pad.top + ih} L${xOf(0)},${pad.top + ih} Z`
  const yTicks = [min, min + range * 0.5, max].map((v) => Math.round(v))
  const xStep = Math.max(1, Math.floor(data.length / 5))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      <defs>
        <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pad.left} y1={yOf(v)} x2={w - pad.right} y2={yOf(v)} stroke="currentColor" strokeOpacity="0.08" />
          <text x={pad.left - 6} y={yOf(v) + 4} textAnchor="end" fontSize="10" fill="currentColor" fillOpacity="0.5">{fmt(v)}</text>
        </g>
      ))}
      {data.filter((_, i) => i % xStep === 0 || i === data.length - 1).map((d, _, arr) => {
        const i = data.indexOf(d)
        return (
          <text key={d.date} x={xOf(i)} y={h - 4} textAnchor="middle" fontSize="10" fill="currentColor" fillOpacity="0.4">
            {d.date.slice(5)}
          </text>
        )
      })}
      <path d={area} fill="url(#grad)" />
      <polyline points={pts} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={i} cx={xOf(i)} cy={yOf(d.followers)} r="3" fill="#6366f1" fillOpacity="0.8" />
      ))}
    </svg>
  )
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, trend, icon, color = '#6366f1' }: {
  label: string; value: string | number; sub?: string; trend?: number[]; icon: React.ReactNode; color?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">{icon}{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{typeof value === 'number' ? fmt(value) : value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {trend && trend.length >= 2 && <Sparkline values={trend} color={color} />}
    </div>
  )
}

// ── Post Detail Modal ─────────────────────────────────────────────────────────

function PostModal({ post, followers, onClose }: { post: SocialPost; followers: number; onClose: () => void }) {
  const engagement = followers > 0 && post.likeCount !== undefined && post.commentsCount !== undefined
    ? ((post.likeCount + post.commentsCount) / followers) * 100
    : undefined

  const typeLabel = post.mediaType === 'VIDEO' ? 'Reel/Video' : post.mediaType === 'CAROUSEL_ALBUM' ? 'Karussell' : 'Bild'
  const typeColor = post.mediaType === 'VIDEO' ? 'bg-purple-100 text-purple-700' : post.mediaType === 'CAROUSEL_ALBUM' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-racing-900 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-racing-800">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeColor}`}>{typeLabel}</span>
            <span className="text-xs text-gray-400">{formatFriendlyDateTime(post.postedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            {post.permalink && (
              <a href={post.permalink} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">
                <ExternalLink size={12} /> Auf Instagram
              </a>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto">
          <div className="flex flex-col sm:flex-row">
            {/* Image */}
            {(post.thumbnailUrl || post.mediaUrl) && (
              <div className="relative flex-shrink-0 bg-black sm:w-64">
                <img
                  src={post.thumbnailUrl ?? post.mediaUrl}
                  alt=""
                  className="h-64 w-full object-cover sm:h-full"
                />
                {post.mediaType === 'VIDEO' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film size={40} className="text-white/80 drop-shadow" />
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-1 flex-col gap-4 p-5">
              {post.caption && (
                <p className="text-sm leading-relaxed text-gray-700 dark:text-racing-200 line-clamp-4">{post.caption}</p>
              )}

              {/* Main metrics grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <Stat icon={<Heart size={14} className="text-red-400" />} label="Likes" value={fmt(post.likeCount)} />
                <Stat icon={<MessageCircle size={14} className="text-blue-400" />} label="Kommentare" value={fmt(post.commentsCount)} />
                <Stat icon={<TrendingUp size={14} className="text-green-400" />} label="Reichweite" value={fmt(post.reach)} />
                <Stat icon={<Bookmark size={14} className="text-yellow-500" />} label="Gespeichert" value={fmt(post.saved)} />
                <Stat icon={<Share2 size={14} className="text-purple-400" />} label="Geteilt" value={fmt(post.shares)} />
                <Stat icon={<Heart size={14} className="text-pink-400" />} label="Interaktionen" value={fmt(post.totalInteractions)} />
              </div>

              {/* Engagement Rate */}
              <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 p-3 dark:from-indigo-900/20 dark:to-purple-900/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Engagement Rate</p>
                <p className="mt-0.5 text-2xl font-bold text-indigo-700 dark:text-indigo-300">{pct(engagement)}</p>
                <p className="text-xs text-indigo-400">(Likes + Kommentare) / Follower</p>
              </div>

              {/* Reach rate */}
              {post.reach !== undefined && followers > 0 && (
                <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-3 dark:from-green-900/20 dark:to-emerald-900/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">Reichweiten-Rate</p>
                  <p className="mt-0.5 text-2xl font-bold text-green-700 dark:text-green-300">{pct((post.reach / followers) * 100)}</p>
                  <p className="text-xs text-green-400">Reichweite / Follower</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-racing-800">
      {icon}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-sm font-bold">{value}</p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SocialAccountDetailPage() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const accounts = useSocialStore((s) => s.accounts)
  const metrics = useSocialStore((s) => s.metrics)
  const posts = useSocialStore((s) => s.posts)
  const stories = useSocialStore((s) => s.stories)
  const fetchAccounts = useSocialStore((s) => s.fetchAccounts)
  const fetchAccountData = useSocialStore((s) => s.fetchAccountData)
  const syncAccount = useSocialStore((s) => s.syncAccount)
  const updateAccessToken = useSocialStore((s) => s.updateAccessToken)
  const deleteAccount = useSocialStore((s) => s.deleteAccount)
  const syncingId = useSocialStore((s) => s.syncingId)

  const [syncError, setSyncError] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [savingToken, setSavingToken] = useState(false)
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null)
  const [tab, setTab] = useState<'posts' | 'stories' | 'growth'>('posts')

  const account = accounts.find((a) => a.id === accountId)

  useEffect(() => { if (accounts.length === 0) fetchAccounts() }, [accounts.length, fetchAccounts])
  useEffect(() => { if (accountId) fetchAccountData(accountId) }, [accountId, fetchAccountData])

  if (!account || !accountId) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-gray-400">
        <p>Account nicht gefunden.</p>
        <button onClick={() => navigate('/social')} className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
          <ArrowLeft size={16} /> Zurück
        </button>
      </div>
    )
  }

  const accountMetrics = metrics[accountId] ?? []
  const latest = accountMetrics[accountMetrics.length - 1]
  const accountPosts = posts[accountId] ?? []
  const accountStories = stories[accountId] ?? []
  const followers = latest?.followersCount ?? 0

  // Engagement rate across all posts
  const avgEngagement = accountPosts.length > 0 && followers > 0
    ? accountPosts.reduce((sum, p) => sum + ((p.likeCount ?? 0) + (p.commentsCount ?? 0)), 0) / accountPosts.length / followers * 100
    : undefined

  // Best post by engagement
  const bestPost = accountPosts.length > 0 ? accountPosts.reduce((best, p) => {
    const eng = (p.likeCount ?? 0) + (p.commentsCount ?? 0)
    const bestEng = (best.likeCount ?? 0) + (best.commentsCount ?? 0)
    return eng > bestEng ? p : best
  }) : null

  async function handleSync() {
    if (!accountId) return
    setSyncError(null)
    const err = await syncAccount(accountId)
    if (err) setSyncError(err)
  }

  async function handleSaveToken(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenInput.trim() || !accountId) return
    setSavingToken(true)
    const err = await updateAccessToken(accountId, tokenInput.trim())
    setSavingToken(false)
    if (!err) setTokenInput('')
  }

  return (
    <div className="pb-10">
      {/* Back */}
      <button onClick={() => navigate('/social')}
        className="mb-4 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-white">
        <ArrowLeft size={14} /> Alle Accounts
      </button>

      {/* Profile header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {account.profilePictureUrl
            ? <img src={account.profilePictureUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-accent/30" />
            : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 text-2xl text-white font-bold">@</div>
          }
          <div>
            <h1 className="text-xl font-bold">@{account.username}</h1>
            {account.name && <p className="text-sm font-medium text-gray-500">{account.name}</p>}
            {account.biography && <p className="mt-1 max-w-sm text-xs text-gray-400">{account.biography}</p>}
            {account.website && (
              <a href={account.website} target="_blank" rel="noreferrer"
                className="mt-1 flex items-center gap-1 text-xs text-accent hover:underline">
                <Link2 size={10} /> {account.website}
              </a>
            )}
            <p className="mt-1 text-xs text-gray-400">
              {account.lastSyncedAt ? `Zuletzt synchronisiert: ${formatFriendlyDateTime(account.lastSyncedAt)}` : 'Noch nicht synchronisiert'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncingId === accountId || !account.accessToken}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60">
            <RefreshCw size={14} className={syncingId === accountId ? 'animate-spin' : ''} />
            {syncingId === accountId ? 'Synchronisiere…' : 'Jetzt synchronisieren'}
          </button>
          <button onClick={async () => { await deleteAccount(accountId); navigate('/social') }}
            className="rounded-xl border border-gray-200 p-2 text-gray-400 hover:border-red-300 hover:text-red-500 dark:border-racing-700">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Token missing */}
      {!account.accessToken && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400"><AlertTriangle size={15} /> Access Token fehlt</p>
          <p className="mb-3 text-sm text-amber-600 dark:text-amber-300">Ohne Token können keine Daten abgerufen werden.</p>
          <form onSubmit={handleSaveToken} className="flex gap-2">
            <input value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="Long-lived Access Token einfügen…"
              className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none dark:bg-racing-800 dark:border-racing-600" />
            <button type="submit" disabled={savingToken || !tokenInput.trim()}
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">
              Speichern
            </button>
          </form>
        </div>
      )}

      {/* Sync error */}
      {syncError && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-400"><AlertTriangle size={15} /> Synchronisierung fehlgeschlagen</p>
          <p className="text-sm text-red-600 dark:text-red-300">{syncError}</p>
          {(syncError.includes('token') || syncError.includes('Token') || syncError.includes('expired') || syncError.includes('OAuth')) && (
            <p className="mt-2 text-xs text-red-500">
              Tipp: Tokens laufen nach 60 Tagen ab. Erstelle einen neuen Long-Lived Token im Meta Graph API Explorer.
            </p>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Follower" value={followers} icon={<Users size={12} />} color="#6366f1"
          trend={accountMetrics.map((m) => m.followersCount ?? 0)} />
        <KpiCard label="Reichweite" value={latest?.reach ?? '–'} icon={<TrendingUp size={12} />} color="#10b981"
          trend={accountMetrics.map((m) => m.reach ?? 0)} />
        <KpiCard label="Ø Engagement" value={avgEngagement !== undefined ? pct(avgEngagement) : '–'}
          icon={<Heart size={12} />} color="#f43f5e" sub="pro Post" />
        <KpiCard label="Profil-Aufrufe" value={latest?.profileViews ?? '–'} icon={<Eye size={12} />} color="#f59e0b"
          trend={accountMetrics.map((m) => m.profileViews ?? 0)} />
        <KpiCard label="Likes" value={latest?.likes ?? '–'} icon={<Heart size={12} />} color="#f43f5e"
          trend={accountMetrics.map((m) => m.likes ?? 0)} />
        <KpiCard label="Kommentare" value={latest?.comments ?? '–'} icon={<MessageCircle size={12} />} color="#3b82f6"
          trend={accountMetrics.map((m) => m.comments ?? 0)} />
        <KpiCard label="Gespeichert" value={latest?.saves ?? '–'} icon={<Bookmark size={12} />} color="#f59e0b"
          trend={accountMetrics.map((m) => m.saves ?? 0)} />
        <KpiCard label="Geteilt" value={latest?.shares ?? '–'} icon={<Repeat2 size={12} />} color="#8b5cf6"
          trend={accountMetrics.map((m) => m.shares ?? 0)} />
      </div>

      {/* Best post highlight */}
      {bestPost && followers > 0 && (
        <div
          onClick={() => setSelectedPost(bestPost)}
          className="mb-6 flex cursor-pointer items-center gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 hover:shadow-md dark:border-indigo-900 dark:from-indigo-900/20 dark:to-purple-900/20"
        >
          {(bestPost.thumbnailUrl || bestPost.mediaUrl) && (
            <img src={bestPost.thumbnailUrl ?? bestPost.mediaUrl} alt="" className="h-16 w-16 flex-shrink-0 rounded-xl object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 mb-0.5">🏆 Bester Post</p>
            <p className="truncate text-sm font-medium">{bestPost.caption ?? 'Kein Caption'}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {fmt(bestPost.likeCount)} Likes · {fmt(bestPost.commentsCount)} Kommentare · {pct(((bestPost.likeCount ?? 0) + (bestPost.commentsCount ?? 0)) / followers * 100)} Engagement
            </p>
          </div>
          <ExternalLink size={16} className="flex-shrink-0 text-indigo-400" />
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-racing-800 dark:bg-racing-900">
        {([['posts', 'Posts', <LayoutGrid size={14} />], ['stories', 'Stories', <Film size={14} />], ['growth', 'Wachstum', <TrendingUp size={14} />]] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${tab === key ? 'bg-white text-accent shadow-sm dark:bg-racing-800' : 'text-gray-500 hover:text-gray-700 dark:text-racing-400'}`}>
            {icon}{label}
            {key === 'posts' && accountPosts.length > 0 && <span className="rounded-full bg-accent/10 px-1.5 text-xs text-accent">{accountPosts.length}</span>}
          </button>
        ))}
      </div>

      {/* Posts grid */}
      {tab === 'posts' && (
        accountPosts.length === 0
          ? <p className="py-10 text-center text-sm text-gray-400">Noch keine Posts synchronisiert. Klicke auf "Jetzt synchronisieren".</p>
          : (
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {accountPosts.map((post) => {
                const eng = followers > 0 ? ((post.likeCount ?? 0) + (post.commentsCount ?? 0)) / followers * 100 : 0
                return (
                  <button key={post.id} onClick={() => setSelectedPost(post)}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-racing-800">
                    {(post.thumbnailUrl || post.mediaUrl)
                      ? <img src={post.thumbnailUrl ?? post.mediaUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      : <div className="flex h-full items-center justify-center"><ImageIcon size={24} className="text-gray-400" /></div>
                    }
                    {post.mediaType === 'VIDEO' && (
                      <div className="absolute top-1.5 right-1.5"><Film size={14} className="text-white drop-shadow" /></div>
                    )}
                    {post.mediaType === 'CAROUSEL_ALBUM' && (
                      <div className="absolute top-1.5 right-1.5"><LayoutGrid size={14} className="text-white drop-shadow" /></div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex items-center gap-3 text-white text-sm font-semibold">
                        <span className="flex items-center gap-1"><Heart size={14} /> {fmt(post.likeCount)}</span>
                        <span className="flex items-center gap-1"><MessageCircle size={14} /> {fmt(post.commentsCount)}</span>
                      </div>
                      {followers > 0 && <p className="text-xs text-white/80">{pct(eng)} Engagement</p>}
                    </div>
                  </button>
                )
              })}
            </div>
          )
      )}

      {/* Stories */}
      {tab === 'stories' && (
        accountStories.length === 0
          ? <p className="py-10 text-center text-sm text-gray-400">Keine aktiven Stories (nur letzte 24h verfügbar).</p>
          : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accountStories.map((story) => (
                <div key={story.id} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
                  <p className="mb-3 text-xs text-gray-400">{formatFriendlyDateTime(story.postedAt)}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat icon={<Eye size={14} className="text-blue-400" />} label="Impressionen" value={fmt(story.impressions)} />
                    <Stat icon={<TrendingUp size={14} className="text-green-400" />} label="Reichweite" value={fmt(story.reach)} />
                    <Stat icon={<MessageCircle size={14} className="text-purple-400" />} label="Antworten" value={fmt(story.replies)} />
                    <Stat icon={<X size={14} className="text-red-400" />} label="Abbrüche" value={fmt(story.exits)} />
                    <Stat icon={<ArrowLeft size={14} className="text-gray-400" />} label="Zurück" value={fmt(story.tapsBack)} />
                    <Stat icon={<ArrowLeft size={14} className="text-gray-400 rotate-180" />} label="Weiter" value={fmt(story.tapsForward)} />
                  </div>
                </div>
              ))}
            </div>
          )
      )}

      {/* Growth chart */}
      {tab === 'growth' && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-racing-800 dark:bg-racing-900">
          <h2 className="mb-4 font-semibold">Follower-Wachstum</h2>
          <GrowthChart data={accountMetrics.filter((m) => m.followersCount !== undefined).map((m) => ({ date: m.date, followers: m.followersCount! }))} />
        </div>
      )}

      {/* Post Modal */}
      {selectedPost && (
        <PostModal post={selectedPost} followers={followers} onClose={() => setSelectedPost(null)} />
      )}
    </div>
  )
}
