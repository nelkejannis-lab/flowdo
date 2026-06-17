import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

async function graphGet(path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${GRAPH_BASE}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  const json = await res.json()
  if (json.error) throw new Error(json.error.message ?? 'Instagram API Fehler')
  return json
}

function insightValue(data: any[] | undefined, name: string): number | undefined {
  const entry = (data ?? []).find((d: any) => d.name === name)
  if (!entry) return undefined
  if (entry.total_value && typeof entry.total_value.value === 'number') return entry.total_value.value
  if (Array.isArray(entry.values) && entry.values.length > 0) return entry.values[entry.values.length - 1]?.value
  return undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(supabaseUrl, supabaseKey)

    const { accountId } = await req.json()
    if (!accountId) return new Response(JSON.stringify({ error: 'accountId fehlt' }), { status: 400, headers: corsHeaders })

    // Load account from DB
    const { data: accountRow, error: accountErr } = await db
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (accountErr || !accountRow) {
      return new Response(JSON.stringify({ error: 'Account nicht gefunden' }), { status: 404, headers: corsHeaders })
    }

    const { ig_user_id: igUserId, access_token: accessToken } = accountRow
    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Kein Access Token hinterlegt' }), { status: 400, headers: corsHeaders })
    }

    // 1. Profile
    const profile = await graphGet(`/${igUserId}`, {
      fields: 'followers_count,follows_count,media_count,name,biography,website,profile_picture_url',
      access_token: accessToken,
    })

    await db.from('social_accounts').update({
      name: profile.name ?? null,
      biography: profile.biography ?? null,
      website: profile.website ?? null,
      profile_picture_url: profile.profile_picture_url ?? null,
    }).eq('id', accountId)

    // 2. Account insights
    let reach, profileViews, accountsEngaged, totalInteractions, likes, comments, shares, saves, followsAndUnfollows
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
    } catch { /* insights permissions may not be granted */ }

    const today = new Date().toISOString().slice(0, 10)
    await db.from('social_metrics').upsert({
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
    }, { onConflict: 'account_id,date' })

    // 3. Recent posts (last 24)
    try {
      const media = await graphGet(`/${igUserId}/media`, {
        fields: 'id,caption,media_type,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count',
        limit: '24',
        access_token: accessToken,
      })

      for (const item of media.data ?? []) {
        let postReach, postSaved, postShares, postTotal
        try {
          const mi = await graphGet(`/${item.id}/insights`, {
            metric: 'reach,saved,shares,total_interactions',
            access_token: accessToken,
          })
          postReach = insightValue(mi.data, 'reach')
          postSaved = insightValue(mi.data, 'saved')
          postShares = insightValue(mi.data, 'shares')
          postTotal = insightValue(mi.data, 'total_interactions')
        } catch { /* some media types don't support insights */ }

        await db.from('social_posts').upsert({
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
        }, { onConflict: 'account_id,media_id' })
      }
    } catch { /* ignore media failures */ }

    // 4. Stories
    try {
      const storiesRes = await graphGet(`/${igUserId}/stories`, {
        fields: 'id,media_type,timestamp',
        access_token: accessToken,
      })

      for (const item of storiesRes.data ?? []) {
        let impressions, storyReach, replies, exits, tapsForward, tapsBack
        try {
          const si = await graphGet(`/${item.id}/insights`, {
            metric: 'impressions,reach,replies,navigation',
            access_token: accessToken,
          })
          impressions = insightValue(si.data, 'impressions')
          storyReach = insightValue(si.data, 'reach')
          replies = insightValue(si.data, 'replies')
          const nav = (si.data ?? []).find((d: any) => d.name === 'navigation')
          const breakdown = nav?.total_value?.breakdowns?.[0]?.results ?? []
          for (const e of breakdown) {
            const action = e.dimension_values?.[0]
            if (action === 'exited') exits = e.value
            if (action === 'tap_forward') tapsForward = e.value
            if (action === 'tap_back') tapsBack = e.value
          }
        } catch { /* story insights may be unavailable */ }

        await db.from('social_stories').upsert({
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
        }, { onConflict: 'account_id,media_id' })
      }
    } catch { /* ignore story failures */ }

    // 5. Mark synced
    await db.from('social_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', accountId)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
