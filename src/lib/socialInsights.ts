import type { SocialAccount, SocialMetric, SocialPost } from '../types'
import { getPeriodRange, type StatisticsPeriod } from './statistics'

export type SocialPeriod = StatisticsPeriod

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
  return ((p.likeCount ?? 0) + (p.commentsCount ?? 0)) / followers * 100
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

export interface SocialDashboardData {
  period: SocialPeriod
  startISO: string
  endISO: string
  kpis: SocialOverviewKpis
  engagementSeries: { date: string; value: number }[]
  reachSeries: { date: string; value: number }[]
  topPosts: SocialPost[]
  contentMix: ContentMixSlice[]
  bestHour: number | null
  bestDay: number | null
  insights: SocialInsight[]
  hasSyncedData: boolean
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
    { key: 'VIDEO', label: 'Reels / Video', color: '#8b5cf6' },
    { key: 'CAROUSEL_ALBUM', label: 'Karussell', color: '#3b82f6' },
    { key: 'IMAGE', label: 'Bilder', color: '#10b981' },
    { key: 'OTHER', label: 'Sonstiges', color: '#94a3b8' },
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

function buildInsights(opts: {
  account: SocialAccount
  kpis: SocialOverviewKpis
  contentMix: ContentMixSlice[]
  bestHour: number | null
  bestDay: number | null
  periodPosts: SocialPost[]
  period: SocialPeriod
}): SocialInsight[] {
  const { account, kpis, contentMix, bestHour, bestDay, periodPosts, period } = opts
  const tips: SocialInsight[] = []
  const brand = isFebiAccount(account)
  const brandName = brand ? 'FEBI Bilstein' : `@${account.username}`

  if (bestDay != null && bestHour != null) {
    tips.push({
      id: 'best-time',
      title: 'Beste Posting-Zeit',
      body: `Für ${brandName} performen Beiträge am ${DAY_LABELS[bestDay]} gegen ${bestHour}:00 Uhr am stärksten (gewichtet nach Likes, Kommentaren, Saves und Shares).`,
      tone: 'positive',
    })
  }

  const topFormat = [...contentMix].sort((a, b) => b.avgEngagement - a.avgEngagement)[0]
  if (topFormat && topFormat.avgEngagement > 0) {
    tips.push({
      id: 'format',
      title: 'Stärkstes Format',
      body: `${topFormat.label} liegt bei ${fmtPct(topFormat.avgEngagement)} Ø Engagement — priorisiere dieses Format im Content-Mix${brand ? ' (z. B. Produkt-Reels, Montage-Tipps, Karussell-Checklisten)' : ''}.`,
      tone: 'action',
    })
  }

  if (kpis.engagementRate != null) {
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
      title: `Engagement-Rate (${verdict})`,
      body: `${fmtPct(er)} bezogen auf ${basis} im gewählten Zeitraum. Benchmark Instagram Business oft ca. 1–4 % — ${er < 1 ? 'stärkere Hooks und Fragen in Captions helfen.' : 'halte den Dialog in den ersten 60 Minuten nach dem Post.'}`,
      tone,
    })
  }

  const periodLabel = period === 'today' ? 'heute' : period === 'week' ? 'diese Woche' : 'diesen Monat'
  const targetPosts = period === 'today' ? 1 : period === 'week' ? 4 : 12
  if (kpis.postsInPeriod === 0) {
    tips.push({
      id: 'frequency-empty',
      title: 'Keine Posts im Zeitraum',
      body: `${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)} wurde noch nichts veröffentlicht. Ziel für sichtbare Markenpräsenz: ca. ${targetPosts} Beiträge ${period === 'today' ? 'pro Tag' : period === 'week' ? 'pro Woche' : 'pro Monat'}.`,
      tone: 'action',
    })
  } else if (kpis.postsInPeriod < targetPosts * 0.5 && period !== 'today') {
    tips.push({
      id: 'frequency-low',
      title: 'Posting-Frequenz erhöhen',
      body: `Nur ${kpis.postsInPeriod} Posts ${periodLabel}. Konsistenz (ca. ${targetPosts} ${period === 'week' ? '×/Woche' : '×/Monat'}) hilft dem Algorithmus mehr als einzelne „perfekte“ Beiträge.`,
      tone: 'action',
    })
  }

  const withSaves = periodPosts.filter((p) => (p.saved ?? 0) > 0)
  if (withSaves.length > 0) {
    const avgSaves = withSaves.reduce((s, p) => s + (p.saved ?? 0), 0) / withSaves.length
    tips.push({
      id: 'saves',
      title: 'Saves als Qualitäts-Signal',
      body: `Ø ${fmtCompact(avgSaves)} Saves auf Posts mit Speicherungen. Tutorial-/Checklisten-Content (z. B. Einbau, Verschleiß-Erkennung) steigert Saves und organische Reichweite.`,
      tone: 'positive',
    })
  }

  if (brand && tips.length < 4) {
    tips.push({
      id: 'febi-context',
      title: 'Marken-Fokus FEBI Bilstein',
      body: 'Automotive Aftermarket: kurze Produkt-Reels, Vorher/Nachher-Montage und technische Karussells performen typischerweise besser als reine Lifestyle-Bilder. Nutze klare CTAs („Speichern für die Werkstatt“).',
      tone: 'neutral',
    })
  }

  return tips.slice(0, 5)
}

export function computeSocialDashboard(
  account: SocialAccount,
  metrics: SocialMetric[],
  posts: SocialPost[],
  period: SocialPeriod,
  now = new Date(),
): SocialDashboardData {
  const range = getPeriodRange(period, now)
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

  // Fallback: one point per post day from posts if no daily interaction metrics
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

  const insights = buildInsights({
    account,
    kpis,
    contentMix,
    bestHour,
    bestDay,
    periodPosts: periodPosts.length ? periodPosts : posts.slice(0, 24),
    period,
  })

  return {
    period,
    startISO,
    endISO,
    kpis,
    engagementSeries: seriesEng,
    reachSeries,
    topPosts,
    contentMix,
    bestHour,
    bestDay,
    insights,
    hasSyncedData: metrics.length > 0 || posts.length > 0,
  }
}

export { DAY_LABELS }
