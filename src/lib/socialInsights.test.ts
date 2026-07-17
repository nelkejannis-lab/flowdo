import { describe, expect, it } from 'vitest'
import {
  computeSocialDashboard,
  isFebiAccount,
  pickPrimaryAccount,
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
    const dash = computeSocialDashboard(account, metrics, posts, 'week', new Date('2026-07-17T12:00:00'))
    expect(dash.kpis.followers).toBe(1005)
    expect(dash.kpis.reach).toBe(250)
    expect(dash.kpis.postsInPeriod).toBe(1)
    expect(dash.insights.length).toBeGreaterThan(0)
    expect(dash.insights.length).toBeLessThanOrEqual(3)
    expect(dash.hasSyncedData).toBe(true)
    expect(dash.primarySeriesKind).toBe('reach')
    expect(dash.primarySeries.length).toBeGreaterThanOrEqual(2)
  })
})
