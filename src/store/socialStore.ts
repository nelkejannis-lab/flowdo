import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { SocialAccount, SocialMetric, SocialPost, SocialStory } from '../types'

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

interface SocialAccountRow {
  id: string
  platform: 'instagram'
  username: string
  ig_user_id: string
  access_token: string | null
  name: string | null
  biography: string | null
  website: string | null
  profile_picture_url: string | null
  last_synced_at: string | null
  created_at: string
}

interface SocialMetricRow {
  date: string
  followers_count: number | null
  follows_count: number | null
  media_count: number | null
  reach: number | null
  profile_views: number | null
  accounts_engaged: number | null
  total_interactions: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  follows_and_unfollows: number | null
}

interface SocialPostRow {
  id: string
  media_id: string
  media_type: string | null
  caption: string | null
  permalink: string | null
  media_url: string | null
  thumbnail_url: string | null
  posted_at: string | null
  like_count: number | null
  comments_count: number | null
  reach: number | null
  saved: number | null
  shares: number | null
  total_interactions: number | null
}

interface SocialStoryRow {
  id: string
  media_id: string
  media_type: string | null
  posted_at: string | null
  impressions: number | null
  reach: number | null
  replies: number | null
  exits: number | null
  taps_forward: number | null
  taps_back: number | null
}

function toAccount(row: SocialAccountRow): SocialAccount {
  return {
    id: row.id,
    platform: row.platform,
    username: row.username,
    igUserId: row.ig_user_id,
    accessToken: row.access_token ?? undefined,
    name: row.name ?? undefined,
    biography: row.biography ?? undefined,
    website: row.website ?? undefined,
    profilePictureUrl: row.profile_picture_url ?? undefined,
    lastSyncedAt: row.last_synced_at ?? undefined,
    createdAt: row.created_at,
  }
}

function toMetric(row: SocialMetricRow): SocialMetric {
  return {
    date: row.date,
    followersCount: row.followers_count ?? undefined,
    followsCount: row.follows_count ?? undefined,
    mediaCount: row.media_count ?? undefined,
    reach: row.reach ?? undefined,
    profileViews: row.profile_views ?? undefined,
    accountsEngaged: row.accounts_engaged ?? undefined,
    totalInteractions: row.total_interactions ?? undefined,
    likes: row.likes ?? undefined,
    comments: row.comments ?? undefined,
    shares: row.shares ?? undefined,
    saves: row.saves ?? undefined,
    followsAndUnfollows: row.follows_and_unfollows ?? undefined,
  }
}

function toPost(row: SocialPostRow): SocialPost {
  return {
    id: row.id,
    mediaId: row.media_id,
    mediaType: row.media_type ?? undefined,
    caption: row.caption ?? undefined,
    permalink: row.permalink ?? undefined,
    mediaUrl: row.media_url ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    postedAt: row.posted_at ?? undefined,
    likeCount: row.like_count ?? undefined,
    commentsCount: row.comments_count ?? undefined,
    reach: row.reach ?? undefined,
    saved: row.saved ?? undefined,
    shares: row.shares ?? undefined,
    totalInteractions: row.total_interactions ?? undefined,
  }
}

function toStory(row: SocialStoryRow): SocialStory {
  return {
    id: row.id,
    mediaId: row.media_id,
    mediaType: row.media_type ?? undefined,
    postedAt: row.posted_at ?? undefined,
    impressions: row.impressions ?? undefined,
    reach: row.reach ?? undefined,
    replies: row.replies ?? undefined,
    exits: row.exits ?? undefined,
    tapsForward: row.taps_forward ?? undefined,
    tapsBack: row.taps_back ?? undefined,
  }
}

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${GRAPH_BASE}${path}`)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  const res = await fetch(url.toString())
  const json = await res.json()
  if (json.error) throw new Error(json.error.message ?? 'Instagram-API-Fehler')
  return json
}

function insightValue(data: any[] | undefined, name: string): number | undefined {
  const entry = (data ?? []).find((d) => d.name === name)
  if (!entry) return undefined
  if (entry.total_value && typeof entry.total_value.value === 'number') return entry.total_value.value
  if (Array.isArray(entry.values) && entry.values.length > 0) {
    return entry.values[entry.values.length - 1]?.value
  }
  return undefined
}

interface SocialState {
  accounts: SocialAccount[]
  metrics: Record<string, SocialMetric[]>
  posts: Record<string, SocialPost[]>
  stories: Record<string, SocialStory[]>
  loading: boolean
  error: string | null
  syncingId: string | null
  fetchAccounts: () => Promise<void>
  addAccount: (input: { username: string; igUserId: string; accessToken?: string }) => Promise<string | null>
  updateAccessToken: (accountId: string, accessToken: string) => Promise<string | null>
  deleteAccount: (id: string) => Promise<void>
  fetchAccountData: (accountId: string) => Promise<void>
  syncAccount: (accountId: string) => Promise<string | null>
}

export const useSocialStore = create<SocialState>()((set, get) => ({
  accounts: [],
  metrics: {},
  posts: {},
  stories: {},
  loading: false,
  error: null,
  syncingId: null,

  fetchAccounts: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const accounts = ((data ?? []) as unknown as SocialAccountRow[]).map(toAccount)
    set({ accounts, loading: false })
  },

  addAccount: async (input) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return 'Nicht angemeldet'

    const { error } = await supabase.from('social_accounts').insert({
      owner_id: userId,
      platform: 'instagram',
      username: input.username.trim(),
      ig_user_id: input.igUserId.trim(),
      access_token: input.accessToken?.trim() || null,
    })

    if (error) return error.message

    await get().fetchAccounts()
    return null
  },

  updateAccessToken: async (accountId, accessToken) => {
    const { error } = await supabase
      .from('social_accounts')
      .update({ access_token: accessToken.trim() || null })
      .eq('id', accountId)

    if (error) return error.message

    await get().fetchAccounts()
    return null
  },

  deleteAccount: async (id) => {
    await supabase.from('social_accounts').delete().eq('id', id)
    set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) }))
  },

  fetchAccountData: async (accountId) => {
    const [metricsRes, postsRes, storiesRes] = await Promise.all([
      supabase
        .from('social_metrics')
        .select('*')
        .eq('account_id', accountId)
        .order('date', { ascending: true }),
      supabase
        .from('social_posts')
        .select('*')
        .eq('account_id', accountId)
        .order('posted_at', { ascending: false }),
      supabase
        .from('social_stories')
        .select('*')
        .eq('account_id', accountId)
        .order('posted_at', { ascending: false }),
    ])

    set((state) => ({
      metrics: {
        ...state.metrics,
        [accountId]: ((metricsRes.data ?? []) as unknown as SocialMetricRow[]).map(toMetric),
      },
      posts: {
        ...state.posts,
        [accountId]: ((postsRes.data ?? []) as unknown as SocialPostRow[]).map(toPost),
      },
      stories: {
        ...state.stories,
        [accountId]: ((storiesRes.data ?? []) as unknown as SocialStoryRow[]).map(toStory),
      },
    }))
  },

  syncAccount: async (accountId) => {
    const account = get().accounts.find((a) => a.id === accountId)
    if (!account) return 'Account nicht gefunden'

    if (!account.accessToken) {
      return 'Kein Access Token hinterlegt. Bitte füge einen Access Token hinzu, um zu synchronisieren.'
    }

    set({ syncingId: accountId })
    const { igUserId, accessToken } = account

    try {
      // Profile fields (everything available without extra permissions)
      const profile = await graphGet(`/${igUserId}`, {
        fields: 'followers_count,follows_count,media_count,name,biography,website,profile_picture_url',
        access_token: accessToken,
      })

      await supabase
        .from('social_accounts')
        .update({
          name: profile.name ?? null,
          biography: profile.biography ?? null,
          website: profile.website ?? null,
          profile_picture_url: profile.profile_picture_url ?? null,
        })
        .eq('id', accountId)

      // Account-level insights (last 24h)
      let reach: number | undefined
      let profileViews: number | undefined
      let accountsEngaged: number | undefined
      let totalInteractions: number | undefined
      let likes: number | undefined
      let comments: number | undefined
      let shares: number | undefined
      let saves: number | undefined
      let followsAndUnfollows: number | undefined
      try {
        const insights = await graphGet(`/${igUserId}/insights`, {
          metric: 'reach,profile_views,accounts_engaged,total_interactions,likes,comments,shares,saved,follows_and_unfollows',
          period: 'day',
          metric_type: 'total_value',
          access_token: accessToken,
        })
        reach = insightValue(insights.data, 'reach')
        profileViews = insightValue(insights.data, 'profile_views')
        accountsEngaged = insightValue(insights.data, 'accounts_engaged')
        totalInteractions = insightValue(insights.data, 'total_interactions')
        likes = insightValue(insights.data, 'likes')
        comments = insightValue(insights.data, 'comments')
        shares = insightValue(insights.data, 'shares')
        saves = insightValue(insights.data, 'saved')
        followsAndUnfollows = insightValue(insights.data, 'follows_and_unfollows')
      } catch {
        // insights permissions may not be granted yet – continue without them
      }

      const today = new Date().toISOString().slice(0, 10)
      await supabase.from('social_metrics').upsert(
        {
          account_id: accountId,
          date: today,
          followers_count: profile.followers_count ?? null,
          follows_count: profile.follows_count ?? null,
          media_count: profile.media_count ?? null,
          reach: reach ?? null,
          profile_views: profileViews ?? null,
          accounts_engaged: accountsEngaged ?? null,
          total_interactions: totalInteractions ?? null,
          likes: likes ?? null,
          comments: comments ?? null,
          shares: shares ?? null,
          saves: saves ?? null,
          follows_and_unfollows: followsAndUnfollows ?? null,
        },
        { onConflict: 'account_id,date' }
      )

      // Recent posts
      try {
        const media = await graphGet(`/${igUserId}/media`, {
          fields: 'id,caption,media_type,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count',
          limit: '12',
          access_token: accessToken,
        })

        for (const item of media.data ?? []) {
          let postReach: number | undefined
          let postSaved: number | undefined
          let postShares: number | undefined
          let postTotal: number | undefined
          try {
            const mediaInsights = await graphGet(`/${item.id}/insights`, {
              metric: 'reach,saved,shares,total_interactions',
              access_token: accessToken,
            })
            postReach = insightValue(mediaInsights.data, 'reach')
            postSaved = insightValue(mediaInsights.data, 'saved')
            postShares = insightValue(mediaInsights.data, 'shares')
            postTotal = insightValue(mediaInsights.data, 'total_interactions')
          } catch {
            // some media types don't support insights
          }

          await supabase.from('social_posts').upsert(
            {
              account_id: accountId,
              media_id: item.id,
              media_type: item.media_type ?? null,
              caption: item.caption ?? null,
              permalink: item.permalink ?? null,
              media_url: item.media_url ?? null,
              thumbnail_url: item.thumbnail_url ?? null,
              posted_at: item.timestamp ?? null,
              like_count: item.like_count ?? null,
              comments_count: item.comments_count ?? null,
              reach: postReach ?? null,
              saved: postSaved ?? null,
              shares: postShares ?? null,
              total_interactions: postTotal ?? null,
            },
            { onConflict: 'account_id,media_id' }
          )
        }
      } catch {
        // ignore media fetch failures
      }

      // Active stories (last 24h)
      try {
        const stories = await graphGet(`/${igUserId}/stories`, {
          fields: 'id,media_type,timestamp',
          access_token: accessToken,
        })

        for (const item of stories.data ?? []) {
          let impressions: number | undefined
          let storyReach: number | undefined
          let replies: number | undefined
          let exits: number | undefined
          let tapsForward: number | undefined
          let tapsBack: number | undefined
          try {
            const storyInsights = await graphGet(`/${item.id}/insights`, {
              metric: 'impressions,reach,replies,navigation',
              access_token: accessToken,
            })
            impressions = insightValue(storyInsights.data, 'impressions')
            storyReach = insightValue(storyInsights.data, 'reach')
            replies = insightValue(storyInsights.data, 'replies')

            const navigation = (storyInsights.data ?? []).find((d: any) => d.name === 'navigation')
            const breakdown = navigation?.total_value?.breakdowns?.[0]?.results ?? []
            for (const entry of breakdown) {
              const action = entry.dimension_values?.[0]
              if (action === 'exited') exits = entry.value
              if (action === 'tap_forward') tapsForward = entry.value
              if (action === 'tap_back') tapsBack = entry.value
            }
          } catch {
            // story insights may be unavailable
          }

          await supabase.from('social_stories').upsert(
            {
              account_id: accountId,
              media_id: item.id,
              media_type: item.media_type ?? null,
              posted_at: item.timestamp ?? null,
              impressions: impressions ?? null,
              reach: storyReach ?? null,
              replies: replies ?? null,
              exits: exits ?? null,
              taps_forward: tapsForward ?? null,
              taps_back: tapsBack ?? null,
            },
            { onConflict: 'account_id,media_id' }
          )
        }
      } catch {
        // ignore story fetch failures (no active stories, or permissions)
      }

      await supabase
        .from('social_accounts')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', accountId)

      await Promise.all([get().fetchAccounts(), get().fetchAccountData(accountId)])
      set({ syncingId: null })
      return null
    } catch (err) {
      set({ syncingId: null })
      return err instanceof Error ? err.message : 'Synchronisierung fehlgeschlagen'
    }
  },
}))
