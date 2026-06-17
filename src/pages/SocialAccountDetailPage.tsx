import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Bookmark, Edit2, Eye, Film, Heart, Image as ImageIcon,
  Link2, MessageCircle, RefreshCw, Repeat2, Share2, Trash2,
  TrendingUp, UserPlus, Users, X, ExternalLink, AlertTriangle, LayoutGrid, Check,
} from 'lucide-react'
import { useSocialStore } from '../store/socialStore'
import { supabase } from '../lib/supabase'
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

// ── Edit Account Modal ────────────────────────────────────────────────────────

interface IgFound { igUserId: string; igUsername: string; igName: string; profilePic?: string; followers?: number }

function EditAccountModal({ account, onClose }: { account: { id: string; username: string; igUserId: string; accessToken?: string }; onClose: () => void }) {
  const updateAccount = useSocialStore((s) => s.updateAccount)
  const updateAccessToken = useSocialStore((s) => s.updateAccessToken)
  const [username, setUsername] = useState(account.username)
  const [igUserId, setIgUserId] = useState(account.igUserId)
  const [token, setToken] = useState(account.accessToken ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [foundAccounts, setFoundAccounts] = useState<IgFound[] | null>(null)
  const [validateError, setValidateError] = useState<string | null>(null)

  // Token format hints
  const tokenTrimmed = token.trim()
  const tokenHints: string[] = []
  if (token !== tokenTrimmed) tokenHints.push('⚠️ Token hat Leerzeichen/Zeilenumbrüche am Anfang oder Ende — werden beim Prüfen entfernt.')
  if (tokenTrimmed && !tokenTrimmed.startsWith('EAA')) tokenHints.push('⚠️ Gültige Meta-Tokens beginnen mit "EAA". Prüfe ob du den richtigen Token kopiert hast.')
  if (tokenTrimmed.length > 0 && tokenTrimmed.length < 100) tokenHints.push(`⚠️ Token ist sehr kurz (${tokenTrimmed.length} Zeichen). Long-Lived Tokens sind meist 150–300+ Zeichen.`)

  async function handleValidate() {
    if (!tokenTrimmed) return
    setValidating(true)
    setValidateError(null)
    setFoundAccounts(null)
    const res = await supabase.functions.invoke('instagram-validate', { body: { accessToken: tokenTrimmed } })
    setValidating(false)
    if (res.error || res.data?.error) {
      setValidateError(res.data?.error ?? res.error?.message ?? 'Unbekannter Fehler')
      return
    }
    if (res.data.igAccounts?.length === 0) {
      setValidateError('Token ist gültig, aber es sind keine Instagram Business/Creator Accounts verknüpft. Stelle sicher, dass deine Facebook-Seite mit Instagram verbunden ist.')
      return
    }
    setFoundAccounts(res.data.igAccounts)
  }

  function selectAccount(ig: IgFound) {
    setIgUserId(ig.igUserId)
    setUsername(ig.igUsername || username)
    setFoundAccounts(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !igUserId.trim()) return
    setSaving(true)
    setError(null)
    const err1 = await updateAccount(account.id, { username, igUserId })
    const err2 = token !== account.accessToken ? await updateAccessToken(account.id, token) : null
    setSaving(false)
    if (err1 || err2) { setError(err1 ?? err2); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-racing-900 max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Account bearbeiten</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-4">

          {/* Token first — validate to auto-fill ID */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Access Token</label>
            <textarea value={token} onChange={(e) => { setToken(e.target.value); setFoundAccounts(null); setValidateError(null) }} rows={3}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none dark:border-racing-700" />
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-xs text-gray-400">Long-Lived User Access Token</p>
              <button type="button" onClick={handleValidate} disabled={validating || !token.trim()}
                className="flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-900/30 dark:text-indigo-400">
                {validating ? <RefreshCw size={11} className="animate-spin" /> : <Check size={11} />}
                {validating ? 'Prüfe…' : 'Token prüfen & IG-Accounts laden'}
              </button>
            </div>
          </div>

          {/* Validate error */}
          {/* Token format hints */}
          {tokenHints.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              {tokenHints.map((h, i) => <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{h}</p>)}
            </div>
          )}

          {validateError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-2">{validateError}</p>
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">So erhältst du einen gültigen Token:</p>
              <ol className="list-decimal pl-4 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <li>Gehe zu <strong>developers.facebook.com/tools/explorer</strong></li>
                <li>Wähle oben rechts deine App aus (oder erstelle eine)</li>
                <li>Klicke auf <strong>"Generate Access Token"</strong></li>
                <li>Aktiviere Berechtigungen: <code className="bg-white dark:bg-racing-800 px-1 rounded">instagram_basic</code>, <code className="bg-white dark:bg-racing-800 px-1 rounded">instagram_manage_insights</code>, <code className="bg-white dark:bg-racing-800 px-1 rounded">pages_show_list</code>, <code className="bg-white dark:bg-racing-800 px-1 rounded">pages_read_engagement</code></li>
                <li>Kopiere den Token (beginnt mit <strong>EAA…</strong>)</li>
                <li>Für einen Long-Lived Token: rufe auf<br/><code className="break-all bg-white dark:bg-racing-800 px-1 rounded text-[10px]">graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=SHORT_TOKEN</code></li>
              </ol>
            </div>
          )}

          {/* Found IG accounts — click to select */}
          {foundAccounts && foundAccounts.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-green-600 dark:text-green-400">✓ Token gültig — wähle den richtigen Account:</p>
              <ul className="space-y-2">
                {foundAccounts.map((ig) => (
                  <li key={ig.igUserId}>
                    <button type="button" onClick={() => selectAccount(ig)}
                      className="flex w-full items-center gap-3 rounded-xl border-2 border-transparent bg-gray-50 px-3 py-2.5 text-left hover:border-accent hover:bg-accent/5 dark:bg-racing-800">
                      {ig.profilePic
                        ? <img src={ig.profilePic} alt="" className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                        : <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-yellow-400 text-sm text-white font-bold">@</div>
                      }
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">@{ig.igUsername || ig.igName}</p>
                        <p className="text-xs text-gray-400">ID: {ig.igUserId} · {ig.followers?.toLocaleString('de-DE') ?? '–'} Follower</p>
                      </div>
                      <span className="text-xs font-medium text-accent">Auswählen →</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Instagram Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Instagram User-ID (numerisch)</label>
            <input value={igUserId} onChange={(e) => setIgUserId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none dark:border-racing-700" />
            <p className="mt-1 text-xs text-gray-400">Tipp: "Token prüfen" lädt alle verknüpften IG-Accounts und füllt die ID automatisch aus.</p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800">Abbrechen</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60">
              {saving ? 'Speichern…' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Share Panel ───────────────────────────────────────────────────────────────

interface ProfileResult { id: string; display_name: string; avatar_color: string; avatar_url?: string }

function SharePanel({ account, currentUserId, onClose }: { account: { id: string; sharedWith?: string[] }; currentUserId: string; onClose: () => void }) {
  const shareWithUser = useSocialStore((s) => s.shareWithUser)
  const unshareWithUser = useSocialStore((s) => s.unshareWithUser)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProfileResult[]>([])
  const [sharedProfiles, setSharedProfiles] = useState<ProfileResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if ((account.sharedWith ?? []).length === 0) { setSharedProfiles([]); return }
    supabase.from('profiles').select('id,display_name,avatar_color,avatar_url')
      .in('id', account.sharedWith!)
      .then(({ data }) => setSharedProfiles((data ?? []) as ProfileResult[]))
  }, [account.sharedWith])

  function handleSearch(q: string) {
    setQuery(q)
    clearTimeout(debounce.current)
    if (!q.trim()) { setResults([]); return }
    debounce.current = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase.from('profiles').select('id,display_name,avatar_color,avatar_url')
        .ilike('display_name', `%${q}%`).neq('id', currentUserId).limit(8)
      setResults((data ?? []) as ProfileResult[])
      setLoading(false)
    }, 300)
  }

  const sharedIds = account.sharedWith ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-racing-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Mit Nutzern teilen</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"><X size={18} /></button>
        </div>

        <input value={query} onChange={(e) => handleSearch(e.target.value)}
          placeholder="Nutzer suchen…"
          className="mb-3 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700" />

        {loading && <p className="text-xs text-gray-400 mb-2">Suche…</p>}

        {results.length > 0 && (
          <ul className="mb-4 divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-racing-800 dark:border-racing-800">
            {results.map((p) => {
              const already = sharedIds.includes(p.id)
              return (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: p.avatar_color }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : p.display_name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm font-medium">{p.display_name}</span>
                  <button onClick={() => already ? unshareWithUser(account.id, p.id) : shareWithUser(account.id, p.id)}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${already ? 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 dark:bg-racing-800' : 'bg-accent/10 text-accent hover:bg-accent hover:text-white'}`}>
                    {already ? <><Check size={12} /> Geteilt</> : <><UserPlus size={12} /> Teilen</>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {sharedProfiles.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Geteilt mit</p>
            <ul className="space-y-1">
              {sharedProfiles.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-racing-800">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: p.avatar_color }}>
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" /> : p.display_name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm">{p.display_name}</span>
                  <button onClick={() => unshareWithUser(account.id, p.id)}
                    className="rounded-lg p-1 text-gray-400 hover:text-red-500"><X size={14} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const [showEdit, setShowEdit] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null))
  }, [])

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
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={handleSync} disabled={syncingId === accountId || !account.accessToken}
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60">
            <RefreshCw size={14} className={syncingId === accountId ? 'animate-spin' : ''} />
            {syncingId === accountId ? 'Synchronisiere…' : 'Synchronisieren'}
          </button>
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800">
            <Edit2 size={14} /> Bearbeiten
          </button>
          {account.ownerId === currentUserId && (
            <button onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-racing-700 dark:text-racing-200 dark:hover:bg-racing-800">
              <Share2 size={14} /> Teilen
              {(account.sharedWith?.length ?? 0) > 0 && (
                <span className="rounded-full bg-accent/10 px-1.5 text-xs text-accent">{account.sharedWith!.length}</span>
              )}
            </button>
          )}
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

      {/* Edit Modal */}
      {showEdit && (
        <EditAccountModal
          account={{ id: accountId, username: account.username, igUserId: account.igUserId, accessToken: account.accessToken }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Share Panel */}
      {showShare && currentUserId && (
        <SharePanel
          account={{ id: accountId, sharedWith: account.sharedWith }}
          currentUserId={currentUserId}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  )
}
