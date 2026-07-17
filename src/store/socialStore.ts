import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { SocialAccount, SocialMetric, SocialPost, SocialStory } from '../types'

interface SocialAccountRow {
  id: string
  owner_id: string
  platform: 'instagram'
  username: string
  ig_user_id: string
  token_configured: boolean
  name: string | null
  biography: string | null
  website: string | null
  profile_picture_url: string | null
  last_synced_at: string | null
  created_at: string
  shared_with: string[] | null
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
  media_url: string | null
  thumbnail_url: string | null
  impressions: number | null
  reach: number | null
  replies: number | null
  exits: number | null
  taps_forward: number | null
  taps_back: number | null
}

const ACCOUNT_COLUMNS = 'id, owner_id, platform, username, ig_user_id, token_configured, name, biography, website, profile_picture_url, last_synced_at, created_at, shared_with'

function toAccount(row: SocialAccountRow): SocialAccount {
  return {
    id: row.id,
    ownerId: row.owner_id,
    platform: row.platform,
    username: row.username,
    igUserId: row.ig_user_id,
    tokenConfigured: row.token_configured,
    name: row.name ?? undefined,
    biography: row.biography ?? undefined,
    website: row.website ?? undefined,
    profilePictureUrl: row.profile_picture_url ?? undefined,
    lastSyncedAt: row.last_synced_at ?? undefined,
    createdAt: row.created_at,
    sharedWith: row.shared_with ?? [],
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
    mediaUrl: row.media_url ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    impressions: row.impressions ?? undefined,
    reach: row.reach ?? undefined,
    replies: row.replies ?? undefined,
    exits: row.exits ?? undefined,
    tapsForward: row.taps_forward ?? undefined,
    tapsBack: row.taps_back ?? undefined,
  }
}

interface SocialState {
  accounts: SocialAccount[]
  metrics: Record<string, SocialMetric[]>
  posts: Record<string, SocialPost[]>
  stories: Record<string, SocialStory[]>
  loading: boolean
  dataLoading: boolean
  dataFetchedAt: Record<string, number>
  error: string | null
  syncingId: string | null
  fetchAccounts: () => Promise<void>
  addAccount: (input: { username: string; igUserId: string; accessToken?: string }) => Promise<string | null>
  updateAccount: (accountId: string, input: { username: string; igUserId: string }) => Promise<string | null>
  updateAccessToken: (accountId: string, accessToken: string) => Promise<string | null>
  deleteAccount: (id: string) => Promise<void>
  fetchAccountData: (accountId: string, opts?: { force?: boolean }) => Promise<void>
  fetchAllAccountData: (opts?: { force?: boolean }) => Promise<void>
  syncAccount: (accountId: string) => Promise<string | null>
  shareWithUser: (accountId: string, targetUserId: string) => Promise<string | null>
  unshareWithUser: (accountId: string, targetUserId: string) => Promise<string | null>
}

const DATA_CACHE_MS = 60_000

export const useSocialStore = create<SocialState>()((set, get) => ({
  accounts: [],
  metrics: {},
  posts: {},
  stories: {},
  loading: false,
  dataLoading: false,
  dataFetchedAt: {},
  error: null,
  syncingId: null,

  fetchAccounts: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('social_accounts')
      .select(ACCOUNT_COLUMNS)
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

    const { data, error } = await supabase.from('social_accounts').insert({
      owner_id: userId,
      platform: 'instagram',
      username: input.username.trim(),
      ig_user_id: input.igUserId.trim(),
      token_configured: false,
    }).select('id').single()

    if (error) return error.message

    if (input.accessToken?.trim()) {
      const tokenErr = await get().updateAccessToken(data.id, input.accessToken)
      if (tokenErr) return tokenErr
    }

    await get().fetchAccounts()
    return null
  },

  updateAccount: async (accountId, input) => {
    const { error } = await supabase
      .from('social_accounts')
      .update({ username: input.username.trim(), ig_user_id: input.igUserId.trim() })
      .eq('id', accountId)
    if (error) return error.message
    await get().fetchAccounts()
    return null
  },

  updateAccessToken: async (accountId, accessToken) => {
    const { error } = await supabase.rpc('set_social_account_token', {
      p_account_id: accountId,
      p_token: accessToken.trim(),
    })
    if (error) return error.message
    await get().fetchAccounts()
    return null
  },

  shareWithUser: async (accountId, targetUserId) => {
    const { error } = await supabase.rpc('social_account_share', { p_account_id: accountId, p_user_id: targetUserId })
    if (error) return error.message
    await get().fetchAccounts()
    return null
  },

  unshareWithUser: async (accountId, targetUserId) => {
    const { error } = await supabase.rpc('social_account_unshare', { p_account_id: accountId, p_user_id: targetUserId })
    if (error) return error.message
    await get().fetchAccounts()
    return null
  },

  deleteAccount: async (id) => {
    await supabase.from('social_accounts').delete().eq('id', id)
    set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) }))
  },

  fetchAccountData: async (accountId, opts) => {
    const force = opts?.force === true
    const last = get().dataFetchedAt[accountId] ?? 0
    if (!force && last > 0 && Date.now() - last < DATA_CACHE_MS) return

    const [metricsRes, postsRes, storiesRes] = await Promise.all([
      supabase.from('social_metrics').select('*').eq('account_id', accountId).order('date', { ascending: true }),
      supabase.from('social_posts').select('*').eq('account_id', accountId).order('posted_at', { ascending: false }),
      supabase.from('social_stories').select('*').eq('account_id', accountId).order('posted_at', { ascending: false }),
    ])

    set((state) => ({
      metrics: { ...state.metrics, [accountId]: ((metricsRes.data ?? []) as unknown as SocialMetricRow[]).map(toMetric) },
      posts: { ...state.posts, [accountId]: ((postsRes.data ?? []) as unknown as SocialPostRow[]).map(toPost) },
      stories: { ...state.stories, [accountId]: ((storiesRes.data ?? []) as unknown as SocialStoryRow[]).map(toStory) },
      dataFetchedAt: { ...state.dataFetchedAt, [accountId]: Date.now() },
    }))
  },

  fetchAllAccountData: async (opts) => {
    const accounts = get().accounts
    if (!accounts.length) return
    set({ dataLoading: true })
    try {
      await Promise.all(accounts.map((a) => get().fetchAccountData(a.id, opts)))
    } finally {
      set({ dataLoading: false })
    }
  },

  syncAccount: async (accountId) => {
    const account = get().accounts.find((a) => a.id === accountId)
    if (!account) return 'Account nicht gefunden'

    if (!account.tokenConfigured) {
      return 'Kein Access Token hinterlegt. Bitte füge einen Access Token hinzu, um zu synchronisieren.'
    }

    set({ syncingId: accountId })

    try {
      const res = await supabase.functions.invoke('instagram-sync', { body: { accountId } })

      if (res.error) throw new Error(res.error.message ?? 'Synchronisierung fehlgeschlagen')
      if (res.data?.error) throw new Error(res.data.error)

      await Promise.all([get().fetchAccounts(), get().fetchAccountData(accountId, { force: true })])
      set({ syncingId: null })
      if (res.data?.warnings?.length) return `⚠️ ${res.data.warnings[0]}`
      return null
    } catch (err) {
      set({ syncingId: null })
      return err instanceof Error ? err.message : 'Synchronisierung fehlgeschlagen'
    }
  },
}))
