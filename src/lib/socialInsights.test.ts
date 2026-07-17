import { describe, expect, it } from 'vitest'
import {
  buildPeriodBenchmarks,
  buildPostInsight,
  canGoNextMonth,
  clampSocialRange,
  computeSocialDashboard,
  isFebiAccount,
  META_INSIGHTS_MAX_DAYS,
  monthLabel,
  pickPrimaryAccount,
  resolveSocialRange,
  scorePostAgainstBenchmarks,
  shiftMonthAnchor,
} from './socialInsights'
import type { SocialAccount, SocialMetric, SocialPost } from '../types'

const account: SocialAccount = {
  id: 'a1',
  platform: 'instagram',
  username: 'febi.bilstein',
  igUserId: '1',
  name: 'FEBI Bilstein',
  createdAt: '2026-01-01',
  tokenConfigured: true,
}

describe('socialInsights', () => {
  it('detects FEBI accounts and prefers them', () => {
    expect(isFebiAccount(account)).toBe(true)
    const other: SocialAccount = { ...account, id: 'a2', username: 'other.brand', name: 'Other' }
    expect(pickPrimaryAccount([other, account])?.id).toBe('a1')
  })

  it('aggregates KPIs for the week without inventing numbers', () => {
    const metrics: SocialMetric[] = [
      { date: '2026-07-13', followersCount: 1000, reach: 100, totalInteractions: 20, likes: 10, comments: 2 },
      { date: '2026-07-14', followersCount: 1005, reach: 150, totalInteractions: 30, likes: 15, comments: 3 },
    ]
    const posts: SocialPost[] = [
      {
        id: 'p1',
        mediaId: 'm1',
        mediaType: 'VIDEO',
        postedAt: '2026-07-14T10:00:00.000Z',
        likeCount: 50,
        commentsCount: 5,
        saved: 8,
      },
    ]
    const dash = computeSocialDashboard(account, metrics, posts, 'week', {
      now: new Date('2026-07-17T12:00:00'),
    })
    expect(dash.kpis.followers).toBe(1005)
    expect(dash.kpis.reach).toBe(250)
    expect(dash.kpis.postsInPeriod).toBe(1)
    expect(dash.insights.length).toBeGreaterThan(0)
    expect(dash.insights.length).toBeLessThanOrEqual(3)
    expect(dash.kpiExplainers.length).toBeGreaterThan(0)
    expect(dash.hasSyncedData).toBe(true)
    expect(dash.primarySeriesKind).toBe('reach')
    expect(dash.primarySeries.length).toBeGreaterThanOrEqual(2)
    expect(dash.benchmarks.postCount).toBe(1)
  })

  it('supports custom ranges and clamps to Meta 90-day window', () => {
    const now = new Date('2026-07-17T12:00:00')
    const range = clampSocialRange('2025-01-01', '2026-07-17', now)
    expect(range.clamped).toBe(true)
    expect(range.warning).toBeTruthy()
    const span =
      (new Date(range.endISO).getTime() - new Date(range.startISO).getTime()) / 86_400_000 + 1
    expect(span).toBeLessThanOrEqual(META_INSIGHTS_MAX_DAYS)
  })

  it('navigates months and disables future next', () => {
    const now = new Date('2026-07-17T12:00:00')
    const july = '2026-07-01'
    expect(monthLabel(july).toLowerCase()).toContain('juli')
    expect(shiftMonthAnchor(july, -1)).toBe('2026-06-01')
    expect(canGoNextMonth(july, now)).toBe(false)
    expect(canGoNextMonth('2026-06-01', now)).toBe(true)

    const range = resolveSocialRange('monthNav', { monthAnchor: '2026-06-01', now })
    expect(range.startISO).toBe('2026-06-01')
    expect(range.endISO).toBe('2026-06-30')
    expect(range.label.toLowerCase()).toContain('juni')
  })

  it('builds post-level insights from real metrics', () => {
    const post: SocialPost = {
      id: 'p1',
      mediaId: 'm1',
      mediaType: 'VIDEO',
      likeCount: 80,
      commentsCount: 12,
      saved: 20,
      shares: 4,
      reach: 900,
      postedAt: '2026-07-14T10:00:00.000Z',
    }
    const insight = buildPostInsight(post, 1000)
    expect(insight.engagementRate).toBeCloseTo(9.2, 1)
    expect(insight.takeaway.length).toBeGreaterThan(10)
    expect(insight.analysis.length).toBeGreaterThan(10)
    expect(insight.strengths.length).toBeGreaterThan(0)
    expect(insight.score).not.toBeNull()
    expect(insight.score!).toBeGreaterThanOrEqual(1)
    expect(insight.score!).toBeLessThanOrEqual(10)
    expect(insight.formulaNote).toContain('Periodendurchschnitt')
  })

  it('scores posts relative to period averages', () => {
    const peers: SocialPost[] = [
      { id: 'a', mediaId: 'a', likeCount: 20, commentsCount: 2, saved: 2, reach: 200 },
      { id: 'b', mediaId: 'b', likeCount: 22, commentsCount: 2, saved: 3, reach: 220 },
      {
        id: 'star',
        mediaId: 's',
        mediaType: 'VIDEO',
        likeCount: 80,
        commentsCount: 12,
        saved: 20,
        shares: 4,
        reach: 900,
        postedAt: '2026-07-15T14:00:00.000Z',
      },
    ]
    const bench = buildPeriodBenchmarks(peers, 1000)
    expect(bench.avgEngagementRate).toBeGreaterThan(0)
    const star = scorePostAgainstBenchmarks(peers[2], 1000, bench)
    const weak = scorePostAgainstBenchmarks(peers[0], 1000, bench)
    expect(star.score).not.toBeNull()
    expect(weak.score).not.toBeNull()
    expect(star.score!).toBeGreaterThan(weak.score!)
    expect(star.vsPeriodPct).not.toBeNull()
    expect(star.vsPeriodPct!).toBeGreaterThan(0)

    const insight = buildPostInsight(peers[2], 1000, bench)
    expect(insight.analysis).toMatch(/über|Durchschnitt|Reel/i)
    expect(insight.scoreLabel).toBe(insight.score!.toFixed(1))
  })
})
