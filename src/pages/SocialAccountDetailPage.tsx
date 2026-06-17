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

function KpiCard({ label, value, sub, trend, icon, color = '#6366f1', metricKey, delta }: {
  label: string; value: string | number; sub?: string; trend?: number[]; icon: React.ReactNode; color?: string; metricKey?: string
  delta?: { pct: number; up: boolean } | null
}) {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <>
      <div className="flex flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">{icon}{label}</span>
          <div className="flex items-center gap-1">
            {delta && (
              <span className={`text-xs font-semibold ${delta.up ? 'text-green-500' : 'text-red-400'}`}>
                {delta.up ? '▲' : '▼'}{delta.pct.toFixed(1)}%
              </span>
            )}
            {metricKey && METRIC_INFO[metricKey] && (
              <button onClick={() => setShowInfo(true)} className="rounded-full p-0.5 text-gray-300 hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors" title="Was bedeutet das?">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </button>
            )}
          </div>
        </div>
        <p className="text-2xl font-bold tracking-tight">{typeof value === 'number' ? fmt(value) : value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
        {delta && <p className="text-[10px] text-gray-400">vs. Vorwoche</p>}
        {trend && trend.length >= 2 && <Sparkline values={trend} color={color} />}
      </div>
      {showInfo && metricKey && <MetricExplainer metricKey={metricKey} label={label} onClose={() => setShowInfo(false)} />}
    </>
  )
}

// ── Post Detail Modal ─────────────────────────────────────────────────────────

function PostModal({ post, followers, onClose }: { post: SocialPost; followers: number; onClose: () => void }) {
  const engagement = followers > 0 && post.likeCount !== undefined && post.commentsCount !== undefined
    ? ((post.likeCount + post.commentsCount) / followers) * 100
    : undefined

  const { score, grade, color: scoreColor, tips: scoreTips } = calcPostScore(post, followers)
  const captionStats = analyzeCaptionStyle(post.caption ?? '')
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
              <div className="relative flex-shrink-0 bg-black sm:w-56">
                <img src={post.thumbnailUrl ?? post.mediaUrl} alt="" className="h-56 w-full object-cover sm:h-full" />
                {post.mediaType === 'VIDEO' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film size={40} className="text-white/80 drop-shadow" />
                  </div>
                )}
              </div>
            )}

            {/* Stats */}
            <div className="flex flex-1 flex-col gap-4 p-5">
              {/* Post Score */}
              <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: `${scoreColor}15`, border: `1px solid ${scoreColor}40` }}>
                <div className="relative h-14 w-14 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={scoreColor} strokeWidth="3"
                      strokeDasharray={`${score} 100`} strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color: scoreColor }}>{score}</span>
                </div>
                <div>
                  <p className="font-bold" style={{ color: scoreColor }}>{grade}</p>
                  <p className="text-xs text-gray-500">Post-Performance Score</p>
                </div>
              </div>

              {/* Main metrics */}
              <div className="grid grid-cols-2 gap-2">
                <Stat icon={<Heart size={14} className="text-red-400" />} label="Likes" value={fmt(post.likeCount)} />
                <Stat icon={<MessageCircle size={14} className="text-blue-400" />} label="Kommentare" value={fmt(post.commentsCount)} />
                <Stat icon={<TrendingUp size={14} className="text-green-400" />} label="Reichweite" value={fmt(post.reach)} />
                <Stat icon={<Bookmark size={14} className="text-yellow-500" />} label="Gespeichert" value={fmt(post.saved)} />
                <Stat icon={<Share2 size={14} className="text-purple-400" />} label="Geteilt" value={fmt(post.shares)} />
                <Stat icon={<Heart size={14} className="text-pink-400" />} label="Interaktionen" value={fmt(post.totalInteractions)} />
              </div>

              {/* Rates */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-900/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500">Engagement Rate</p>
                  <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">{pct(engagement)}</p>
                  <p className="text-[10px] text-indigo-400">Likes+Komm. / Follower</p>
                </div>
                {post.reach !== undefined && followers > 0 && (
                  <div className="rounded-xl bg-green-50 p-3 dark:bg-green-900/20">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-green-500">Reichweiten-Rate</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-300">{pct((post.reach / followers) * 100)}</p>
                    <p className="text-[10px] text-green-400">Reichweite / Follower</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Caption + Tips */}
          <div className="border-t border-gray-100 p-5 dark:border-racing-800 space-y-4">
            {/* Caption */}
            {post.caption && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Caption-Analyse</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {captionStats.map((s, i) => (
                    <div key={i} className="rounded-lg bg-gray-50 p-2 text-center dark:bg-racing-800">
                      <p className="text-[10px] text-gray-400">{s.label}</p>
                      <p className="text-sm font-bold" style={{ color: s.color }}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-racing-800 rounded-xl p-3 line-clamp-4">{post.caption}</p>
              </div>
            )}

            {/* Improvement tips */}
            {scoreTips.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-500">💡 Verbesserungstipps für diesen Post</p>
                <ul className="space-y-1.5">
                  {scoreTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                      <span className="mt-0.5 flex-shrink-0">→</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Caption formula tip */}
            <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 p-3 dark:from-indigo-900/20 dark:to-purple-900/20">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">📖 Perfekte Caption-Formel</p>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                <strong>Hook</strong> (1 starker Satz) → <strong>Wert</strong> (2–4 Sätze mit echtem Mehrwert) → <strong>Frage/CTA</strong> ("Was denkst du?" oder "Link in Bio") → <strong>Hashtags</strong> (5–10 nischige)
              </p>
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
  const [diagSteps, setDiagSteps] = useState<{ label: string; ok: boolean; detail: string }[] | null>(null)

  // Token format hints
  const tokenTrimmed = token.trim()
  const tokenHints: string[] = []
  if (token !== tokenTrimmed) tokenHints.push('⚠️ Token hat Leerzeichen/Zeilenumbrüche am Anfang oder Ende — werden beim Prüfen entfernt.')
  if (tokenTrimmed && !tokenTrimmed.startsWith('EAA') && !tokenTrimmed.startsWith('IGAA')) tokenHints.push('⚠️ Meta-Tokens beginnen mit "EAA" (ältere Apps) oder "IGAA" (neue Instagram API). Prüfe ob du den richtigen Token kopiert hast.')
  if (tokenTrimmed.length > 0 && tokenTrimmed.length < 100) tokenHints.push(`⚠️ Token ist sehr kurz (${tokenTrimmed.length} Zeichen). Long-Lived Tokens sind meist 150–300+ Zeichen.`)

  async function handleValidate() {
    if (!tokenTrimmed) return
    setValidating(true)
    setValidateError(null)
    setFoundAccounts(null)
    setDiagSteps(null)
    const res = await supabase.functions.invoke('instagram-validate', { body: { accessToken: tokenTrimmed } })
    setValidating(false)
    if (res.error) { setValidateError(res.error.message); return }
    const d = res.data
    if (d?.steps) setDiagSteps(d.steps)
    if (d?.error) { setValidateError(d.error); return }
    if (!d?.valid || !d?.igAccounts?.length) {
      setValidateError(null) // steps already show the problem
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

          {/* OAuth connect button */}
          <div className="rounded-xl border border-pink-200 bg-gradient-to-r from-pink-50 to-purple-50 p-3 dark:border-pink-900 dark:from-pink-900/20 dark:to-purple-900/20">
            <p className="mb-2 text-xs font-semibold text-pink-700 dark:text-pink-400">Empfohlen: Mit Instagram verbinden (alle Berechtigungen)</p>
            <a
              href={(() => {
                const url = new URL('https://www.instagram.com/oauth/authorize')
                url.searchParams.set('client_id', '1337831181889435')
                url.searchParams.set('redirect_uri', 'https://mooncrew.app/instagram-callback')
                url.searchParams.set('response_type', 'code')
                url.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish')
                return url.toString()
              })()}
              onClick={() => sessionStorage.setItem('ig_connect_account_id', account.id)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              Instagram neu verbinden
            </a>
          </div>

          {/* Token first — validate to auto-fill ID */}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Oder: Token manuell eingeben</label>
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

          {/* Diagnostic steps */}
          {diagSteps && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-racing-700 dark:bg-racing-800">
              <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-300">Diagnose:</p>
              <ul className="space-y-1.5">
                {diagSteps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className={s.ok ? 'text-green-500 mt-0.5' : 'text-red-500 mt-0.5'}>{s.ok ? '✓' : '✗'}</span>
                    <div>
                      <span className="font-semibold">{s.label}: </span>
                      <span className={s.ok ? 'text-gray-600 dark:text-gray-400' : 'text-red-600 dark:text-red-400'}>{s.detail}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validateError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
              <p className="text-xs font-semibold text-red-700 dark:text-red-400">{validateError}</p>
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

// ── Metric definitions ────────────────────────────────────────────────────────
const METRIC_INFO: Record<string, { what: string; good: string; tip: string; color: string }> = {
  followers: {
    what: 'Gesamtzahl der Accounts, die dir folgen.',
    good: 'Wächst dein Account jeden Monat um 1–3%? Das ist gesundes organisches Wachstum.',
    tip: 'Follower kaufen schadet dem Algorithmus. Echte Follower = höhere Reichweite für alle Posts.',
    color: '#6366f1',
  },
  reach: {
    what: 'Wie viele einzigartige Accounts deine Inhalte heute gesehen haben.',
    good: 'Für Business-Accounts: 10–20% deiner Follower täglich ist sehr gut. Unter 5% deutet auf schwache Content-Qualität hin.',
    tip: 'Reichweite steigt stark durch Shares und Saves — diese Aktionen signalisieren Instagram "wertvoller Content".',
    color: '#10b981',
  },
  engagement: {
    what: '(Likes + Kommentare) ÷ Follower × 100. Zeigt wie aktiv deine Community ist.',
    good: '1–3% = Gut, 3–6% = Sehr gut, >6% = Exzellent. Unter 1% = Content oder Zielgruppe überarbeiten.',
    tip: 'Stelle am Ende jedes Posts eine Frage. Kommentare haben 3× mehr Gewicht als Likes im Algorithmus.',
    color: '#f43f5e',
  },
  profileViews: {
    what: 'Wie viele Personen dein Profil heute besucht haben.',
    good: 'Profil-Aufrufe > 10% der Reichweite = starker CTA in deinen Posts. Unter 2% = Bio oder Content überarbeiten.',
    tip: 'Erste Zeile deiner Bio muss in 3 Sekunden klar machen WER du bist und WEM du hilfst.',
    color: '#f59e0b',
  },
  likes: {
    what: 'Gesamte Likes auf allen Posts heute.',
    good: 'Likes allein sagen wenig. Wichtiger ist Likes ÷ Reichweite (sollte >3% sein).',
    tip: 'Likes werden durch starke visuelle Hook-Momente in den ersten 0,5 Sekunden eines Reels ausgelöst.',
    color: '#f43f5e',
  },
  comments: {
    what: 'Gesamte Kommentare heute. Instagram wertet Kommentare 3× höher als Likes.',
    good: 'Kommentarrate >1% deiner Reichweite = sehr gut. Unter 0,2% = kein Dialog-Element im Content.',
    tip: 'Antworte auf JEDEN Kommentar in den ersten 60 Minuten — das verdoppelt die organische Reichweite.',
    color: '#3b82f6',
  },
  saves: {
    what: 'Wie oft Posts heute gespeichert wurden. Das stärkste Signal für den Algorithmus.',
    good: 'Save-Rate >2% der Reichweite = Dein Content hat echten Mehrwert. Instagram pusht diesen Content massiv.',
    tip: 'Tutorial-Posts, Listen und "Spar dir das für später"-Content erzielt die meisten Saves.',
    color: '#f59e0b',
  },
  shares: {
    what: 'Wie oft Inhalte per DM geteilt oder in Stories gepostet wurden.',
    good: 'Share-Rate >1% = viral-worthy Content. Shares sind der stärkste Reichweiten-Multiplikator.',
    tip: 'Relatable Content ("Das bin ich 😂") und überraschende Facts werden am häufigsten geteilt.',
    color: '#8b5cf6',
  },
}

// ── Algorithm Tips ────────────────────────────────────────────────────────────
const ALGO_TIPS = [
  { emoji: '⏰', title: 'Beste Posting-Zeiten', desc: 'Di–Do 7–9 Uhr oder 18–21 Uhr. Sonntag hat oft 20% höhere Engagement-Rates als Montag.' },
  { emoji: '🔁', title: 'Konsistenz schlägt Qualität', desc: '4–5× pro Woche posten > 1× perfekten Post. Der Algorithmus bevorzugt aktive Accounts.' },
  { emoji: '💬', title: 'Kommentare in der Golden Hour', desc: 'In den ersten 60 Min nach dem Post auf JEDEN Kommentar antworten. Das pusht Reichweite um bis zu 50%.' },
  { emoji: '📌', title: 'Saves sind König', desc: 'Instagram wertet Saves als "wertvoller Content" und zeigt ihn mehr Nicht-Followern. Tutorial-Content = meiste Saves.' },
  { emoji: '🎣', title: 'Hook in 3 Sekunden', desc: 'Erste 3 Sekunden eines Reels entscheiden über alles. Starte mit einer Frage, Überraschung oder boldery Statement.' },
  { emoji: '#️⃣', title: 'Hashtag-Strategie 2024', desc: '5–10 nischige Hashtags (100K–500K Posts) schlagen 30 generische. Kombiniere: 3 Nische + 3 Mittelgroß + 2 Brand.' },
  { emoji: '📖', title: 'Caption-Formel', desc: 'Hook (1 Satz) → Wert (2–4 Sätze) → CTA (Frage/Aufruf). Nutze Zeilenumbrüche für Lesbarkeit.' },
  { emoji: '🎬', title: 'Reels pushen alles', desc: 'Reels bekommen 2–3× mehr Reichweite als Bilder. Auch 7-Sekunden-Reels mit starkem Hook performen gut.' },
]

function AlgorithmTipsPanel() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-6 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-purple-50 dark:border-indigo-900 dark:from-indigo-900/10 dark:to-purple-900/10">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚀</span>
          <div>
            <p className="font-semibold text-indigo-800 dark:text-indigo-300">Instagram Algorithmus 2025 — Tipps & Tricks</p>
            <p className="text-xs text-indigo-500">8 aktuelle Best Practices für maximale Reichweite</p>
          </div>
        </div>
        <span className={`text-indigo-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-3 px-5 pb-5 sm:grid-cols-2">
          {ALGO_TIPS.map((tip, i) => (
            <div key={i} className="rounded-xl bg-white/70 p-3 dark:bg-racing-900/50">
              <p className="mb-1 font-semibold text-sm">{tip.emoji} {tip.title}</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{tip.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Metric Explainer Modal ────────────────────────────────────────────────────
function MetricExplainer({ metricKey, label, onClose }: { metricKey: string; label: string; onClose: () => void }) {
  const info = METRIC_INFO[metricKey]
  if (!info) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl dark:bg-racing-900" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold text-base">{label}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-racing-800">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Was bedeutet das?</p>
            <p className="text-sm leading-relaxed">{info.what}</p>
          </div>
          <div className="rounded-xl bg-green-50 p-3 dark:bg-green-900/20">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-green-600">Was ist gut?</p>
            <p className="text-sm leading-relaxed text-green-800 dark:text-green-300">{info.good}</p>
          </div>
          <div className="rounded-xl bg-indigo-50 p-3 dark:bg-indigo-900/20">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-600">💡 Tipp</p>
            <p className="text-sm leading-relaxed text-indigo-800 dark:text-indigo-300">{info.tip}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Post Score ────────────────────────────────────────────────────────────────
function calcPostScore(post: SocialPost, followers: number): { score: number; grade: string; color: string; tips: string[] } {
  const tips: string[] = []
  let score = 0

  const eng = followers > 0 ? ((post.likeCount ?? 0) + (post.commentsCount ?? 0)) / followers * 100 : 0
  if (eng >= 6) score += 30
  else if (eng >= 3) score += 20
  else if (eng >= 1) score += 10
  else tips.push('Engagement-Rate unter 1% — stelle eine Frage am Ende der Caption.')

  const saveRate = followers > 0 && post.saved ? post.saved / followers * 100 : 0
  if (saveRate >= 2) score += 25
  else if (saveRate >= 0.5) score += 15
  else if (post.saved === undefined) score += 0
  else tips.push('Wenige Saves — füge Mehrwert hinzu: Listen, Tutorials, Checklisten.')

  const shareRate = followers > 0 && post.shares ? post.shares / followers * 100 : 0
  if (shareRate >= 1) score += 25
  else if (shareRate >= 0.2) score += 10
  else if (post.shares !== undefined) tips.push('Wenige Shares — nutze relatable oder überraschende Inhalte.')

  const caption = post.caption ?? ''
  const hashtagCount = (caption.match(/#\w+/g) ?? []).length
  if (hashtagCount >= 5 && hashtagCount <= 12) score += 10
  else if (hashtagCount > 0) score += 5
  else tips.push('Keine Hashtags — 5–10 nischige Hashtags können Reichweite um 20–30% steigern.')

  if (caption.length > 50) score += 10
  else if (caption.length > 0) { score += 5; tips.push('Caption sehr kurz — längere Captions mit Hook + Wert + Frage performen besser.') }
  else tips.push('Kein Caption — ein starker Text-Hook erhöht die Verweildauer und Kommentare.')

  const grade = score >= 80 ? '🏆 Exzellent' : score >= 60 ? '⭐ Gut' : score >= 40 ? '📈 Ausbaubar' : '💡 Lernpotenzial'
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#6366f1' : score >= 40 ? '#f59e0b' : '#f43f5e'

  return { score: Math.min(score, 100), grade, color, tips }
}

function analyzeCaptionStyle(caption: string): { label: string; value: string; color: string }[] {
  if (!caption) return []
  const hashtags = (caption.match(/#\w+/g) ?? []).length
  const emojis = (caption.match(/\p{Emoji}/gu) ?? []).length
  const words = caption.trim().split(/\s+/).length
  const hasQuestion = /\?/.test(caption)
  const hasCTA = /link in bio|mehr dazu|jetzt|klick|schreib|kommentier|teil|save|sichern/i.test(caption)
  const lines = caption.split('\n').length

  return [
    { label: 'Wörter', value: words.toString(), color: words > 30 ? '#10b981' : '#f59e0b' },
    { label: 'Hashtags', value: hashtags.toString(), color: hashtags >= 5 && hashtags <= 12 ? '#10b981' : hashtags > 0 ? '#f59e0b' : '#f43f5e' },
    { label: 'Emojis', value: emojis.toString(), color: emojis >= 2 && emojis <= 8 ? '#10b981' : emojis > 0 ? '#f59e0b' : '#6b7280' },
    { label: 'Frage?', value: hasQuestion ? '✓ Ja' : '✗ Nein', color: hasQuestion ? '#10b981' : '#f43f5e' },
    { label: 'CTA', value: hasCTA ? '✓ Ja' : '✗ Nein', color: hasCTA ? '#10b981' : '#f43f5e' },
    { label: 'Absätze', value: lines.toString(), color: lines > 2 ? '#10b981' : '#f59e0b' },
  ]
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
  const [syncWarning, setSyncWarning] = useState<string | null>(null)
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

  // Period comparison helpers
  function periodAvg(key: keyof typeof latest, daysBack: number, span: number) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - daysBack)
    const end = new Date(); end.setDate(end.getDate() - (daysBack - span))
    const slice = accountMetrics.filter(m => { const d = new Date(m.date); return d >= cutoff && d < end })
    if (!slice.length) return undefined
    const vals = slice.map(m => (m[key] as number | undefined) ?? 0).filter(v => v > 0)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined
  }
  function delta(curr: number | undefined, prev: number | undefined): { pct: number; up: boolean } | null {
    if (curr == null || prev == null || prev === 0) return null
    const p = ((curr - prev) / prev) * 100
    return { pct: Math.abs(p), up: p >= 0 }
  }

  const prevFollowers = accountMetrics.length >= 2
    ? accountMetrics[accountMetrics.length - 8]?.followersCount
    : undefined
  const followerDelta = delta(followers || undefined, prevFollowers)

  const reachDelta = delta(periodAvg('reach', 0, 7), periodAvg('reach', 7, 7))
  const likesDelta = delta(periodAvg('likes', 0, 7), periodAvg('likes', 7, 7))
  const savesDelta = delta(periodAvg('saves', 0, 7), periodAvg('saves', 7, 7))
  const commentsDelta = delta(periodAvg('comments', 0, 7), periodAvg('comments', 7, 7))
  const sharesDelta = delta(periodAvg('shares', 0, 7), periodAvg('shares', 7, 7))
  const profileViewsDelta = delta(periodAvg('profileViews', 0, 7), periodAvg('profileViews', 7, 7))

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
    setSyncWarning(null)
    const msg = await syncAccount(accountId)
    if (msg?.startsWith('⚠️')) setSyncWarning(msg)
    else if (msg) setSyncError(msg)
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

      {/* Sync warning (permissions missing) */}
      {syncWarning && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="mb-1 flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400"><AlertTriangle size={15} /> Teilweise synchronisiert</p>
          <p className="text-sm text-amber-700 dark:text-amber-300">{syncWarning.replace('⚠️ ', '')}</p>
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Lösung: Füge in deiner Meta-App die Berechtigung <strong>instagram_business_manage_insights</strong> hinzu und erstelle einen neuen Token.
          </p>
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

      {/* Algorithm Tips */}
      <AlgorithmTipsPanel />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Follower" value={followers} icon={<Users size={12} />} color="#6366f1" metricKey="followers"
          trend={accountMetrics.map((m) => m.followersCount ?? 0)} delta={followerDelta} />
        <KpiCard label="Reichweite" value={latest?.reach ?? '–'} icon={<TrendingUp size={12} />} color="#10b981" metricKey="reach"
          trend={accountMetrics.map((m) => m.reach ?? 0)} delta={reachDelta} />
        <KpiCard label="Ø Engagement" value={avgEngagement !== undefined ? pct(avgEngagement) : '–'}
          icon={<Heart size={12} />} color="#f43f5e" sub="pro Post" metricKey="engagement" />
        <KpiCard label="Profil-Aufrufe" value={latest?.profileViews ?? '–'} icon={<Eye size={12} />} color="#f59e0b" metricKey="profileViews"
          trend={accountMetrics.map((m) => m.profileViews ?? 0)} delta={profileViewsDelta} />
        <KpiCard label="Likes" value={latest?.likes ?? '–'} icon={<Heart size={12} />} color="#f43f5e" metricKey="likes"
          trend={accountMetrics.map((m) => m.likes ?? 0)} delta={likesDelta} />
        <KpiCard label="Kommentare" value={latest?.comments ?? '–'} icon={<MessageCircle size={12} />} color="#3b82f6" metricKey="comments"
          trend={accountMetrics.map((m) => m.comments ?? 0)} delta={commentsDelta} />
        <KpiCard label="Gespeichert" value={latest?.saves ?? '–'} icon={<Bookmark size={12} />} color="#f59e0b" metricKey="saves"
          trend={accountMetrics.map((m) => m.saves ?? 0)} delta={savesDelta} />
        <KpiCard label="Geteilt" value={latest?.shares ?? '–'} icon={<Repeat2 size={12} />} color="#8b5cf6" metricKey="shares"
          trend={accountMetrics.map((m) => m.shares ?? 0)} delta={sharesDelta} />
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
          ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 dark:border-racing-800 dark:bg-racing-900 text-center">
              <p className="text-2xl mb-2">📖</p>
              <p className="font-medium text-gray-600 dark:text-gray-300 mb-1">Keine Story-Daten verfügbar</p>
              <p className="text-sm text-gray-400 max-w-sm mx-auto">Instagram gibt Story-Daten nur für die letzten 24h zurück. Synchronisiere täglich um Story-Performance zu tracken.</p>
              <div className="mt-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 p-3 text-left">
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">💡 Story-Tipps für mehr Reichweite</p>
                <ul className="text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
                  <li>→ 5–7 Stories täglich für maximale Algorithmus-Sichtbarkeit</li>
                  <li>→ Erste Story des Tages bis 9 Uhr posten</li>
                  <li>→ Umfragen & Fragen-Sticker erhöhen Antworten 3×</li>
                  <li>→ Abbrüche (Exits) unter 20% anstreben</li>
                </ul>
              </div>
            </div>
          )
          : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accountStories.map((story) => {
                const retentionRate = story.impressions && story.exits
                  ? (1 - story.exits / story.impressions) * 100
                  : undefined
                return (
                  <div key={story.id} className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs text-gray-400">{formatFriendlyDateTime(story.postedAt)}</p>
                      {retentionRate !== undefined && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${retentionRate >= 80 ? 'bg-green-100 text-green-700' : retentionRate >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                          {retentionRate.toFixed(0)}% behalten
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Stat icon={<Eye size={14} className="text-blue-400" />} label="Impressionen" value={fmt(story.impressions)} />
                      <Stat icon={<TrendingUp size={14} className="text-green-400" />} label="Reichweite" value={fmt(story.reach)} />
                      <Stat icon={<MessageCircle size={14} className="text-purple-400" />} label="Antworten" value={fmt(story.replies)} />
                      <Stat icon={<X size={14} className="text-red-400" />} label="Abbrüche" value={fmt(story.exits)} />
                      <Stat icon={<ArrowLeft size={14} className="text-gray-400" />} label="Zurück" value={fmt(story.tapsBack)} />
                      <Stat icon={<ArrowLeft size={14} className="text-gray-400 rotate-180" />} label="Weiter" value={fmt(story.tapsForward)} />
                    </div>
                  </div>
                )
              })}
            </div>
          )
      )}

      {/* Growth chart */}
      {tab === 'growth' && (
        <>
        {/* Best posting times from real data */}
        {accountPosts.length >= 3 && (() => {
          const byHour: Record<number, { total: number; count: number }> = {}
          const byDay: Record<number, { total: number; count: number }> = {}
          const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
          accountPosts.forEach(p => {
            if (!p.postedAt) return
            const d = new Date(p.postedAt)
            const h = d.getHours()
            const day = d.getDay()
            const eng = (p.likeCount ?? 0) + (p.commentsCount ?? 0) + (p.saved ?? 0) * 3 + (p.shares ?? 0) * 2
            byHour[h] = { total: (byHour[h]?.total ?? 0) + eng, count: (byHour[h]?.count ?? 0) + 1 }
            byDay[day] = { total: (byDay[day]?.total ?? 0) + eng, count: (byDay[day]?.count ?? 0) + 1 }
          })
          const bestHours = Object.entries(byHour).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count)).slice(0, 3)
          const bestDays = Object.entries(byDay).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count)).slice(0, 3)
          return (
            <div className="mb-4 rounded-2xl border border-gray-100 bg-white p-5 dark:border-racing-800 dark:bg-racing-900">
              <h2 className="mb-3 font-semibold">📊 Deine besten Posting-Zeiten (aus echten Daten)</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Beste Uhrzeiten</p>
                  {bestHours.map(([h], i) => (
                    <div key={h} className="mb-1.5 flex items-center gap-2">
                      <span className="w-5 text-xs font-bold text-indigo-500">#{i + 1}</span>
                      <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">{h}:00 Uhr</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Beste Wochentage</p>
                  {bestDays.map(([d], i) => (
                    <div key={d} className="mb-1.5 flex items-center gap-2">
                      <span className="w-5 text-xs font-bold text-purple-500">#{i + 1}</span>
                      <span className="rounded-lg bg-purple-50 px-2.5 py-1 text-sm font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">{days[Number(d)]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-400">Basiert auf Ø Engagement (Likes + Kommentare + Saves×3 + Shares×2) deiner {accountPosts.length} gespeicherten Posts.</p>
            </div>
          )
        })()}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-racing-800 dark:bg-racing-900">
          <h2 className="mb-4 font-semibold">Follower-Wachstum</h2>
          <GrowthChart data={accountMetrics.filter((m) => m.followersCount !== undefined).map((m) => ({ date: m.date, followers: m.followersCount! }))} />
        </div>
        </>
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
