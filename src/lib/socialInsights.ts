import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns'
import { de } from 'date-fns/locale'
import type { SocialAccount, SocialMetric, SocialPost } from '../types'
import { getPeriodRange, type PeriodRange, type StatisticsPeriod } from './statistics'

/** Presets + custom range + calendar month navigation. */
export type SocialPeriod = StatisticsPeriod | 'custom' | 'monthNav'

/** Meta Instagram insights are typically available for ~90 days. */
export const META_INSIGHTS_MAX_DAYS = 90

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

export function isFebiAccount(account: Pick<SocialAccount, 'username' | 'name'>): boolean {
  const hay = `${account.username} ${account.name ?? ''}`.toLowerCase()
  return hay.includes('febi') || hay.includes('bilstein')
}

/** Prefer FEBI Bilstein when connected; otherwise first account. */
export function pickPrimaryAccount(accounts: SocialAccount[]): SocialAccount | undefined {
  if (!accounts.length) return undefined
  return accounts.find(isFebiAccount) ?? accounts[0]
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '–'
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return Math.round(n).toLocaleString('de-DE')
}

export function fmtPct(n: number | null | undefined, digits = 2): string {
  if (n == null || Number.isNaN(n)) return '–'
  return `${n.toFixed(digits)}%`
}

function postDay(iso?: string): string | undefined {
  return iso?.slice(0, 10)
}

function engagementScore(p: SocialPost): number {
  return (p.likeCount ?? 0) + (p.commentsCount ?? 0) + (p.saved ?? 0) * 3 + (p.shares ?? 0) * 2
}

function postEngagementRate(p: SocialPost, followers: number): number {
  if (followers <= 0) return 0
  return (((p.likeCount ?? 0) + (p.commentsCount ?? 0)) / followers) * 100
}

export interface SocialOverviewKpis {
  followers: number | null
  reach: number
  profileViews: number
  interactions: number
  likes: number
  comments: number
  saves: number
  shares: number
  postsInPeriod: number
  /** Engagement vs reach when reach > 0; else vs followers. */
  engagementRate: number | null
  engagementBasis: 'reach' | 'followers' | null
}

export interface ContentMixSlice {
  key: 'VIDEO' | 'CAROUSEL_ALBUM' | 'IMAGE' | 'OTHER'
  label: string
  count: number
  avgEngagement: number
  color: string
}

export interface SocialInsight {
  id: string
  title: string
  body: string
  tone: 'positive' | 'neutral' | 'action'
}

export interface KpiExplainer {
  key: string
  label: string
  short: string
  implication: string
}

export interface PostInsight {
  formatLabel: string
  engagementRate: number | null
  reachRate: number | null
  interactions: number
  strengths: string[]
  takeaway: string
  tone: 'positive' | 'neutral' | 'action'
}

export interface SocialRangeResult extends PeriodRange {
  clamped: boolean
  warning?: string
  /** Human label for the active range (e.g. "Juni 2026"). */
  label: string
}

export interface SocialDashboardData {
  period: SocialPeriod
  startISO: string
  endISO: string
  rangeLabel: string
  rangeClamped: boolean
  rangeWarning?: string
  kpis: SocialOverviewKpis
  kpiExplainers: KpiExplainer[]
  engagementSeries: { date: string; value: number }[]
  reachSeries: { date: string; value: number }[]
  /** Primary series for the overview chart (reach preferred, else engagement). */
  primarySeries: { date: string; value: number }[]
  primarySeriesKind: 'reach' | 'engagement'
  topPosts: SocialPost[]
  contentMix: ContentMixSlice[]
  bestHour: number | null
  bestDay: number | null
  insights: SocialInsight[]
  hasSyncedData: boolean
}

export interface SocialRangeOpts {
  /** Custom from/to (yyyy-MM-dd) when period === 'custom'. */
  from?: string
  to?: string
  /** Anchor month (yyyy-MM-01 or any day in month) when period === 'monthNav'. */
  monthAnchor?: string
  now?: Date
}

function daysBetweenInclusive(startISO: string, endISO: string): number {
  const a = parseISO(startISO)
  const b = parseISO(endISO)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
}

function earliestMetaISO(now = new Date()): string {
  return format(addDays(now, -(META_INSIGHTS_MAX_DAYS - 1)), 'yyyy-MM-dd')
}

/** Clamp a free range to Meta’s ~90-day window and ensure from ≤ to. */
export function clampSocialRange(fromISO: string, toISO: string, now = new Date()): SocialRangeResult {
  let start = fromISO <= toISO ? fromISO : toISO
  let end = fromISO <= toISO ? toISO : fromISO
  const today = format(now, 'yyyy-MM-dd')
  if (end > today) end = today

  const earliest = earliestMetaISO(now)
  let clamped = false
  if (start < earliest) {
    start = earliest
    clamped = true
  }
  if (end < start) end = start

  const span = daysBetweenInclusive(start, end)
  if (span > META_INSIGHTS_MAX_DAYS) {
    start = format(addDays(parseISO(end), -(META_INSIGHTS_MAX_DAYS - 1)), 'yyyy-MM-dd')
    clamped = true
  }

  const dayISOs: string[] = []
  for (let d = parseISO(start); d <= parseISO(end); d = addDays(d, 1)) {
    dayISOs.push(format(d, 'yyyy-MM-dd'))
  }

  return {
    startISO: start,
    endISO: end,
    dayISOs,
    clamped,
    warning: clamped
      ? `Zeitraum auf die letzten ${META_INSIGHTS_MAX_DAYS} Tage begrenzt (Meta-API).`
      : undefined,
    label: `${start} – ${end}`,
  }
}

export function monthLabel(anchorISO: string): string {
  const d = parseISO(anchorISO.length === 7 ? `${anchorISO}-01` : anchorISO)
  return format(d, 'LLLL yyyy', { locale: de })
}

/** Previous/next calendar month anchors (yyyy-MM-dd = first of month). */
export function shiftMonthAnchor(anchorISO: string, delta: -1 | 1): string {
  const d = parseISO(anchorISO.length === 7 ? `${anchorISO}-01` : anchorISO)
  const next = delta === 1 ? addMonths(startOfMonth(d), 1) : subMonths(startOfMonth(d), 1)
  return format(next, 'yyyy-MM-dd')
}

export function canGoNextMonth(anchorISO: string, now = new Date()): boolean {
  const d = parseISO(anchorISO.length === 7 ? `${anchorISO}-01` : anchorISO)
  const next = addMonths(startOfMonth(d), 1)
  return startOfMonth(next) <= startOfMonth(now)
}

export function resolveSocialRange(period: SocialPeriod, opts: SocialRangeOpts = {}): SocialRangeResult {
  const now = opts.now ?? new Date()

  if (period === 'custom' && opts.from && opts.to) {
    return clampSocialRange(opts.from, opts.to, now)
  }

  if (period === 'monthNav') {
    const anchor = opts.monthAnchor ?? format(startOfMonth(now), 'yyyy-MM-dd')
    const start = format(startOfMonth(parseISO(anchor)), 'yyyy-MM-dd')
    const monthEnd = format(endOfMonth(parseISO(anchor)), 'yyyy-MM-dd')
    const today = format(now, 'yyyy-MM-dd')
    const end = monthEnd > today ? today : monthEnd
    const clamped = clampSocialRange(start, end, now)
    return {
      ...clamped,
      label: monthLabel(anchor),
    }
  }

  const preset = getPeriodRange(period as StatisticsPeriod, now)
  const clamped = clampSocialRange(preset.startISO, preset.endISO, now)
  const periodLabel =
    period === 'today' ? 'Heute' : period === 'week' ? 'Diese Woche' : 'Dieser Monat'
  return { ...clamped, label: periodLabel }
}

function sumMetricField(metrics: SocialMetric[], start: string, end: string, key: keyof SocialMetric): number {
  return metrics
    .filter((m) => m.date >= start && m.date <= end)
    .reduce((s, m) => s + (typeof m[key] === 'number' ? (m[key] as number) : 0), 0)
}

function postsInRange(posts: SocialPost[], start: string, end: string): SocialPost[] {
  return posts.filter((p) => {
    const d = postDay(p.postedAt)
    return d != null && d >= start && d <= end
  })
}

function buildContentMix(posts: SocialPost[], followers: number): ContentMixSlice[] {
  const buckets: Record<ContentMixSlice['key'], SocialPost[]> = {
    VIDEO: [],
    CAROUSEL_ALBUM: [],
    IMAGE: [],
    OTHER: [],
  }
  for (const p of posts) {
    const t = p.mediaType
    if (t === 'VIDEO' || t === 'CAROUSEL_ALBUM' || t === 'IMAGE') buckets[t].push(p)
    else buckets.OTHER.push(p)
  }
  const meta: Array<{ key: ContentMixSlice['key']; label: string; color: string }> = [
    { key: 'VIDEO', label: 'Reels / Video', color: 'rgb(var(--accent))' },
    { key: 'CAROUSEL_ALBUM', label: 'Karussell', color: '#64748b' },
    { key: 'IMAGE', label: 'Bilder', color: '#94a3b8' },
    { key: 'OTHER', label: 'Sonstiges', color: '#cbd5e1' },
  ]
  return meta
    .map(({ key, label, color }) => {
      const list = buckets[key]
      const avg =
        list.length && followers > 0
          ? list.reduce((s, p) => s + postEngagementRate(p, followers), 0) / list.length
          : 0
      return { key, label, count: list.length, avgEngagement: avg, color }
    })
    .filter((s) => s.count > 0)
}

function bestPostingSlots(posts: SocialPost[]): { bestHour: number | null; bestDay: number | null } {
  if (posts.length < 3) return { bestHour: null, bestDay: null }
  const byHour: Record<number, { total: number; count: number }> = {}
  const byDay: Record<number, { total: number; count: number }> = {}
  for (const p of posts) {
    if (!p.postedAt) continue
    const d = new Date(p.postedAt)
    const h = d.getHours()
    const day = d.getDay()
    const eng = engagementScore(p)
    byHour[h] = { total: (byHour[h]?.total ?? 0) + eng, count: (byHour[h]?.count ?? 0) + 1 }
    byDay[day] = { total: (byDay[day]?.total ?? 0) + eng, count: (byDay[day]?.count ?? 0) + 1 }
  }
  const bestHour = Object.entries(byHour).sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)[0]
  const bestDay = Object.entries(byDay).sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)[0]
  return {
    bestHour: bestHour ? Number(bestHour[0]) : null,
    bestDay: bestDay ? Number(bestDay[0]) : null,
  }
}

function formatLabel(mediaType?: string): string {
  if (mediaType === 'VIDEO') return 'Reel / Video'
  if (mediaType === 'CAROUSEL_ALBUM') return 'Karussell'
  if (mediaType === 'IMAGE') return 'Bild'
  return 'Beitrag'
}

/** Short German takeaway for a single post — real metrics only. */
export function buildPostInsight(post: SocialPost, followers: number): PostInsight {
  const likes = post.likeCount ?? 0
  const comments = post.commentsCount ?? 0
  const saves = post.saved ?? 0
  const shares = post.shares ?? 0
  const interactions = post.totalInteractions ?? likes + comments + saves + shares
  const eng = followers > 0 ? ((likes + comments) / followers) * 100 : null
  const reachRate = post.reach != null && followers > 0 ? (post.reach / followers) * 100 : null

  const strengths: string[] = []
  if (saves > 0 && (followers <= 0 || saves / Math.max(followers, 1) >= 0.005 || saves >= 10)) {
    strengths.push(`${fmtCompact(saves)} Saves`)
  }
  if (shares > 0) strengths.push(`${fmtCompact(shares)} Shares`)
  if (comments > 0 && likes > 0 && comments / likes >= 0.05) {
    strengths.push('Starker Dialog')
  }
  if (post.reach != null && post.reach > 0) strengths.push(`${fmtCompact(post.reach)} Reach`)
  if (eng != null && eng >= 3) strengths.push(`${fmtPct(eng)} Engagement`)

  let tone: PostInsight['tone'] = 'neutral'
  let takeaway: string

  if (eng != null && eng >= 3) {
    tone = 'positive'
    takeaway =
      saves > likes * 0.1
        ? 'Hohes Engagement und viele Saves — Format und Caption als Vorlage nutzen.'
        : 'Überdurchschnittliches Engagement — Hook und Timing wiederholen.'
  } else if (eng != null && eng < 1 && (likes + comments) > 0) {
    tone = 'action'
    takeaway = 'Engagement unter 1% — stärkere erste Zeile und eine konkrete Frage in der Caption.'
  } else if (saves > 0 && saves >= likes * 0.15) {
    tone = 'positive'
    takeaway = 'Viele Saves relativ zu Likes — Tutorial-/Checklisten-Stil funktioniert hier.'
  } else if (post.reach != null && followers > 0 && post.reach / followers < 0.1 && interactions > 0) {
    tone = 'action'
    takeaway = 'Reichweite niedrig vs. Follower — Shares und Saves fördern organische Verteilung.'
  } else if (interactions === 0 && likes === 0) {
    tone = 'neutral'
    takeaway = 'Noch keine Interaktionsdaten für diesen Beitrag — nach dem nächsten Sync erneut prüfen.'
  } else {
    tone = 'neutral'
    takeaway =
      formatLabel(post.mediaType) === 'Reel / Video'
        ? 'Solide Basis — in den ersten 60 Minuten aktiv auf Kommentare antworten.'
        : 'Solide Werte — bei ähnlichen Themen Karussell oder Reel testen.'
  }

  return {
    formatLabel: formatLabel(post.mediaType),
    engagementRate: eng,
    reachRate,
    interactions,
    strengths: strengths.slice(0, 3),
    takeaway,
    tone,
  }
}

function buildKpiExplainers(kpis: SocialOverviewKpis): KpiExplainer[] {
  const items: KpiExplainer[] = []

  if (kpis.followers != null) {
    items.push({
      key: 'followers',
      label: 'Follower',
      short: 'Accounts, die dem Profil folgen (aktueller Stand).',
      implication:
        'Wachstum allein sagt wenig — Reichweite und Engagement zeigen, ob die Community aktiv ist.',
    })
  }

  items.push({
    key: 'reach',
    label: 'Reichweite',
    short: 'Einzigartige Accounts, die Inhalte im Zeitraum gesehen haben (Summe der Tageswerte).',
    implication:
      kpis.followers && kpis.followers > 0 && kpis.reach > 0
        ? kpis.reach / kpis.followers >= 0.5
          ? `Ca. ${fmtPct((kpis.reach / kpis.followers) * 100, 0)} der Follower-Basis erreicht — stark für organische Sichtbarkeit.`
          : `Ca. ${fmtPct((kpis.reach / kpis.followers) * 100, 0)} der Follower-Basis — Shares/Saves helfen, Nicht-Follower zu erreichen.`
        : 'Ohne Follower-Stand keine relative Einordnung möglich.',
  })

  if (kpis.engagementRate != null) {
    const basis = kpis.engagementBasis === 'reach' ? 'Reichweite' : 'Follower'
    const er = kpis.engagementRate
    items.push({
      key: 'engagement',
      label: 'Engagement',
      short: `Interaktionen ÷ ${basis} × 100 im gewählten Zeitraum.`,
      implication:
        er >= 3
          ? 'Sehr stark (≥3%) — Dialog und Timing beibehalten.'
          : er >= 1
            ? 'Solide (1–3%) — Hooks und Fragen können noch pushen.'
            : 'Unter 1% — Caption-Hook und Call-to-Action prüfen.',
    })
  }

  items.push({
    key: 'posts',
    label: 'Posts',
    short: 'Veröffentlichte Beiträge mit Datum im Zeitraum.',
    implication:
      kpis.postsInPeriod === 0
        ? 'Ohne Posts keine Content-Signale — Frequenz ist oft der größte Hebel.'
        : `${kpis.postsInPeriod} Beiträge — Konsistenz hilft dem Algorithmus mehr als einzelne Ausreißer.`,
  })

  if (kpis.saves > 0 || kpis.profileViews > 0) {
    items.push({
      key: 'saves',
      label: 'Saves',
      short: 'Speicherungen signalisieren „wertvoller Content“ an den Algorithmus.',
      implication:
        kpis.saves > 0
          ? `${fmtCompact(kpis.saves)} Saves im Zeitraum — Tutorials und Checklisten steigern das weiter.`
          : kpis.profileViews > 0
            ? `${fmtCompact(kpis.profileViews)} Profilaufrufe — starker CTA in Bio/Caption kann Conversions heben.`
            : '',
    })
  }

  return items.slice(0, 4)
}

function periodPhrase(period: SocialPeriod, rangeLabel: string): string {
  if (period === 'today') return 'heute'
  if (period === 'week') return 'diese Woche'
  if (period === 'month') return 'diesen Monat'
  if (period === 'monthNav') return `in ${rangeLabel}`
  return `im Zeitraum ${rangeLabel}`
}

function buildInsights(opts: {
  account: SocialAccount
  kpis: SocialOverviewKpis
  contentMix: ContentMixSlice[]
  bestHour: number | null
  bestDay: number | null
  periodPosts: SocialPost[]
  period: SocialPeriod
  rangeLabel: string
}): SocialInsight[] {
  const { account, kpis, contentMix, bestHour, bestDay, periodPosts, period, rangeLabel } = opts
  const tips: SocialInsight[] = []
  const brand = isFebiAccount(account)
  const brandName = brand ? 'FEBI Bilstein' : `@${account.username}`
  const phrase = periodPhrase(period, rangeLabel)

  const targetPosts =
    period === 'today' ? 1 : period === 'week' ? 4 : period === 'month' || period === 'monthNav' ? 12 : 8

  if (kpis.postsInPeriod === 0) {
    tips.push({
      id: 'frequency-empty',
      title: 'Keine Posts im Zeitraum',
      body: `${phrase.charAt(0).toUpperCase() + phrase.slice(1)} wurde nichts veröffentlicht. Orientierung: ca. ${targetPosts} Beiträge in vergleichbaren Fenstern.`,
      tone: 'action',
    })
  } else if (kpis.postsInPeriod < targetPosts * 0.5 && period !== 'today') {
    tips.push({
      id: 'frequency-low',
      title: 'Posting-Frequenz',
      body: `Nur ${kpis.postsInPeriod} Posts ${phrase}. Regelmäßigkeit (Orientierung ~${targetPosts}) oft wirkungsvoller als einzelne „perfekte“ Beiträge.`,
      tone: 'action',
    })
  }

  if (kpis.reach > 0 && kpis.followers && kpis.followers > 0 && tips.length < 3) {
    const ratio = (kpis.reach / kpis.followers) * 100
    tips.push({
      id: 'reach-context',
      title: 'Reichweite einordnen',
      body: `${fmtCompact(kpis.reach)} Reach ≈ ${fmtPct(ratio, 0)} der ${fmtCompact(kpis.followers)} Follower ${phrase}. ${
        ratio >= 50 ? 'Gute organische Sichtbarkeit.' : 'Mehr Saves/Shares erweitern die Nicht-Follower-Reichweite.'
      }`,
      tone: ratio >= 50 ? 'positive' : 'neutral',
    })
  }

  if (kpis.engagementRate != null && tips.length < 3) {
    const er = kpis.engagementRate
    const basis = kpis.engagementBasis === 'reach' ? 'Reichweite' : 'Follower'
    let verdict = 'solide'
    let tone: SocialInsight['tone'] = 'neutral'
    if (er >= 3) {
      verdict = 'sehr stark'
      tone = 'positive'
    } else if (er < 1) {
      verdict = 'ausbaufähig'
      tone = 'action'
    }
    tips.push({
      id: 'engagement',
      title: `Engagement ${verdict}`,
      body: `${fmtPct(er)} bezogen auf ${basis} (${fmtCompact(kpis.interactions)} Interaktionen). ${
        er < 1 ? 'Stärkere Hooks und eine Frage in der Caption helfen.' : 'Dialog in den ersten 60 Minuten nach dem Post halten.'
      }`,
      tone,
    })
  }

  const topFormat = [...contentMix].sort((a, b) => b.avgEngagement - a.avgEngagement)[0]
  if (topFormat && topFormat.avgEngagement > 0 && tips.length < 3) {
    tips.push({
      id: 'format',
      title: 'Stärkstes Format',
      body: `${topFormat.label} bei ${fmtPct(topFormat.avgEngagement)} Ø Engagement — dieses Format priorisieren${
        brand ? ' (Produkt-Reels, Montage-Tipps, Checklisten)' : ''
      }.`,
      tone: 'action',
    })
  }

  if (bestDay != null && bestHour != null && tips.length < 3) {
    tips.push({
      id: 'best-time',
      title: 'Beste Posting-Zeit',
      body: `Für ${brandName} performen Beiträge am ${DAY_LABELS[bestDay]} gegen ${bestHour}:00 am stärksten.`,
      tone: 'positive',
    })
  }

  const withSaves = periodPosts.filter((p) => (p.saved ?? 0) > 0)
  if (withSaves.length > 0 && tips.length < 3) {
    const avgSaves = withSaves.reduce((s, p) => s + (p.saved ?? 0), 0) / withSaves.length
    tips.push({
      id: 'saves',
      title: 'Saves als Qualitäts-Signal',
      body: `Ø ${fmtCompact(avgSaves)} Saves. Tutorial-/Checklisten-Content steigert Speicherungen und organische Reichweite.`,
      tone: 'positive',
    })
  }

  if (brand && tips.length < 3) {
    tips.push({
      id: 'febi-context',
      title: 'FEBI Bilstein Fokus',
      body: 'Kurze Produkt-Reels, Vorher/Nachher-Montage und technische Karussells performen typischerweise besser als reine Lifestyle-Bilder.',
      tone: 'neutral',
    })
  }

  return tips.slice(0, 3)
}

export function computeSocialDashboard(
  account: SocialAccount,
  metrics: SocialMetric[],
  posts: SocialPost[],
  period: SocialPeriod,
  opts: SocialRangeOpts = {},
): SocialDashboardData {
  const now = opts.now ?? new Date()
  const range = resolveSocialRange(period, { ...opts, now })
  const { startISO, endISO } = range

  const periodMetrics = metrics.filter((m) => m.date >= startISO && m.date <= endISO)
  const periodPosts = postsInRange(posts, startISO, endISO)

  const latestWithFollowers = [...metrics].reverse().find((m) => m.followersCount != null)
  const followers = latestWithFollowers?.followersCount ?? null

  const reach = sumMetricField(metrics, startISO, endISO, 'reach')
  const profileViews = sumMetricField(metrics, startISO, endISO, 'profileViews')
  const interactionsFromMetrics = sumMetricField(metrics, startISO, endISO, 'totalInteractions')
  const likesM = sumMetricField(metrics, startISO, endISO, 'likes')
  const commentsM = sumMetricField(metrics, startISO, endISO, 'comments')
  const savesM = sumMetricField(metrics, startISO, endISO, 'saves')
  const sharesM = sumMetricField(metrics, startISO, endISO, 'shares')

  const likesP = periodPosts.reduce((s, p) => s + (p.likeCount ?? 0), 0)
  const commentsP = periodPosts.reduce((s, p) => s + (p.commentsCount ?? 0), 0)
  const savesP = periodPosts.reduce((s, p) => s + (p.saved ?? 0), 0)
  const sharesP = periodPosts.reduce((s, p) => s + (p.shares ?? 0), 0)

  const likes = likesM > 0 ? likesM : likesP
  const comments = commentsM > 0 ? commentsM : commentsP
  const saves = savesM > 0 ? savesM : savesP
  const shares = sharesM > 0 ? sharesM : sharesP
  const interactions =
    interactionsFromMetrics > 0 ? interactionsFromMetrics : likes + comments + saves + shares

  let engagementRate: number | null = null
  let engagementBasis: SocialOverviewKpis['engagementBasis'] = null
  if (reach > 0 && interactions > 0) {
    engagementRate = (interactions / reach) * 100
    engagementBasis = 'reach'
  } else if (followers && followers > 0 && periodPosts.length > 0) {
    engagementRate =
      periodPosts.reduce((s, p) => s + postEngagementRate(p, followers), 0) / periodPosts.length
    engagementBasis = 'followers'
  }

  const engagementSeries = periodMetrics
    .filter((m) => m.totalInteractions != null || m.likes != null)
    .map((m) => ({
      date: m.date,
      value: m.totalInteractions ?? (m.likes ?? 0) + (m.comments ?? 0) + (m.saves ?? 0) + (m.shares ?? 0),
    }))

  const reachSeries = periodMetrics
    .filter((m) => m.reach != null)
    .map((m) => ({ date: m.date, value: m.reach! }))

  let seriesEng = engagementSeries
  if (seriesEng.length < 2 && periodPosts.length > 0) {
    const byDay: Record<string, number> = {}
    for (const p of periodPosts) {
      const d = postDay(p.postedAt)
      if (!d) continue
      byDay[d] = (byDay[d] ?? 0) + engagementScore(p)
    }
    seriesEng = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }))
  }

  const primarySeriesKind: 'reach' | 'engagement' = reachSeries.length >= 2 ? 'reach' : 'engagement'
  const primarySeries = primarySeriesKind === 'reach' ? reachSeries : seriesEng

  const topPosts = [...periodPosts]
    .sort((a, b) => engagementScore(b) - engagementScore(a))
    .slice(0, 5)

  const contentMix = buildContentMix(periodPosts.length ? periodPosts : posts.slice(0, 24), followers ?? 0)
  const { bestHour, bestDay } = bestPostingSlots(posts)

  const kpis: SocialOverviewKpis = {
    followers,
    reach,
    profileViews,
    interactions,
    likes,
    comments,
    saves,
    shares,
    postsInPeriod: periodPosts.length,
    engagementRate,
    engagementBasis,
  }

  const kpiExplainers = buildKpiExplainers(kpis)

  const insights = buildInsights({
    account,
    kpis,
    contentMix,
    bestHour,
    bestDay,
    periodPosts: periodPosts.length ? periodPosts : posts.slice(0, 24),
    period,
    rangeLabel: range.label,
  })

  return {
    period,
    startISO,
    endISO,
    rangeLabel: range.label,
    rangeClamped: range.clamped,
    rangeWarning: range.warning,
    kpis,
    kpiExplainers,
    engagementSeries: seriesEng,
    reachSeries,
    primarySeries,
    primarySeriesKind,
    topPosts,
    contentMix,
    bestHour,
    bestDay,
    insights,
    hasSyncedData: metrics.length > 0 || posts.length > 0,
  }
}

export { DAY_LABELS }
