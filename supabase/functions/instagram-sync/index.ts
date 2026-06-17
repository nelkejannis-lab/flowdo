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
  if (json.error) {
    const msg = json.error.message ?? 'Instagram API Fehler'
    const code = json.error.code ?? ''
    throw new Error(`${msg} (Code ${code})`)
  }
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

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json().catch(() => ({}))
    const { accountId } = body
    if (!accountId) return respond({ error: 'accountId fehlt' }, 400)

    const { data: row, error: rowErr } = await db
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (rowErr || !row) return respond({ error: 'Account nicht gefunden' }, 404)

    let { ig_user_id: igUserId, access_token: accessToken } = row
    if (!accessToken) return respond({ error: 'Kein Access Token hinterlegt. Bitte Token ergänzen.' }, 400)

    // IGAA tokens: Instagram Business Login — /me returns the IG user directly
    // Auto-resolve the correct igUserId from the token if token is IGAA
    if (accessToken.trim().startsWith('IGAA')) {
      try {
        const meRes = await graphGet('/me', { fields: 'id', access_token: accessToken })
        if (meRes.id) igUserId = meRes.id
      } catch { /* use stored igUserId as fallback */ }
    }

    // ── 1. Profile ──────────────────────────────────────────────────────────
    let profile: any
    try {
      profile = await graphGet(`/${igUserId}`, {
        fields: 'followers_count,follows_count,media_count,name,biography,website,profile_picture_url',
        access_token: accessToken,
      })
    } catch (e: any) {
      return respond({ error: `Instagram-Profil konnte nicht geladen werden: ${e.message}` }, 422)
    }

    await db.from('social_accounts').update({
      name: profile.name ?? null,
      biography: profile.biography ?? null,
      website: profile.website ?? null,
      profile_picture_url: profile.profile_picture_url ?? null,
    }).eq('id', accountId)

    // ── 2. Account insights ─────────────────────────────────────────────────
    let reach, profileViews, accountsEngaged, totalInteractions, likes, comments, shares, saves, followsAndUnfollows
    try {
      const ins = await graphGet(`/${igUserId}/insights`, {
        metric: 'reach,profile_views,accounts_engaged,total_interactions,likes,comments,shares,saved,follows_and_unfollows',
        period: 'day',
        metric_type: 'total_value',
        access_token: accessToken,
      })
      reach = insightValue(ins.data, 'reach')
      profileViews = insightValue(ins.data, 'profile_views')
      accountsEngaged = insightValue(ins.data, 'accounts_engaged')
      totalInteractions = insightValue(ins.data, 'total_interactions')
      likes = insightValue(ins.data, 'likes')
      comments = insightValue(ins.data, 'comments')
      shares = insightValue(ins.data, 'shares')
      saves = insightValue(ins.data, 'saved')
      followsAndUnfollows = insightValue(ins.data, 'follows_and_unfollows')
    } catch { /* insights need instagram_manage_insights permission */ }

    const today = new Date().toISOString().slice(0, 10)
    await db.from('social_metrics').upsert({
      account_id: accountId, date: today,
      followers_count: profile.followers_count ?? null,
      follows_count: profile.follows_count ?? null,
      media_count: profile.media_count ?? null,
      reach: reach ?? null, profile_views: profileViews ?? null,
      accounts_engaged: accountsEngaged ?? null, total_interactions: totalInteractions ?? null,
      likes: likes ?? null, comments: comments ?? null, shares: shares ?? null,
      saves: saves ?? null, follows_and_unfollows: followsAndUnfollows ?? null,
    }, { onConflict: 'account_id,date' })

    // ── 3. Posts ────────────────────────────────────────────────────────────
    try {
      const media = await graphGet(`/${igUserId}/media`, {
        fields: 'id,caption,media_type,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count',
        limit: '24',
        access_token: accessToken,
      })
      for (const item of media.data ?? []) {
        let pReach, pSaved, pShares, pTotal
        try {
          const mi = await graphGet(`/${item.id}/insights`, {
            metric: 'reach,saved,shares,total_interactions',
            access_token: accessToken,
          })
          pReach = insightValue(mi.data, 'reach')
          pSaved = insightValue(mi.data, 'saved')
          pShares = insightValue(mi.data, 'shares')
          pTotal = insightValue(mi.data, 'total_interactions')
        } catch { /* some media types don't support insights */ }
        await db.from('social_posts').upsert({
          account_id: accountId, media_id: item.id,
          media_type: item.media_type ?? null, caption: item.caption ?? null,
          permalink: item.permalink ?? null, media_url: item.media_url ?? null,
          thumbnail_url: item.thumbnail_url ?? null, posted_at: item.timestamp ?? null,
          like_count: item.like_count ?? null, comments_count: item.comments_count ?? null,
          reach: pReach ?? null, saved: pSaved ?? null, shares: pShares ?? null,
          total_interactions: pTotal ?? null,
        }, { onConflict: 'account_id,media_id' })
      }
    } catch { /* ignore media failures */ }

    // ── 4. Stories ──────────────────────────────────────────────────────────
    try {
      const st = await graphGet(`/${igUserId}/stories`, {
        fields: 'id,media_type,timestamp',
        access_token: accessToken,
      })
      for (const item of st.data ?? []) {
        let imp, sReach, replies, exits, tapsF, tapsB
        try {
          const si = await graphGet(`/${item.id}/insights`, {
            metric: 'impressions,reach,replies,navigation',
            access_token: accessToken,
          })
          imp = insightValue(si.data, 'impressions')
          sReach = insightValue(si.data, 'reach')
          replies = insightValue(si.data, 'replies')
          const nav = (si.data ?? []).find((d: any) => d.name === 'navigation')
          for (const e of nav?.total_value?.breakdowns?.[0]?.results ?? []) {
            const a = e.dimension_values?.[0]
            if (a === 'exited') exits = e.value
            if (a === 'tap_forward') tapsF = e.value
            if (a === 'tap_back') tapsB = e.value
          }
        } catch { /* story insights may be unavailable */ }
        await db.from('social_stories').upsert({
          account_id: accountId, media_id: item.id,
          media_type: item.media_type ?? null, posted_at: item.timestamp ?? null,
          impressions: imp ?? null, reach: sReach ?? null, replies: replies ?? null,
          exits: exits ?? null, taps_forward: tapsF ?? null, taps_back: tapsB ?? null,
        }, { onConflict: 'account_id,media_id' })
      }
    } catch { /* ignore story failures */ }

    await db.from('social_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', accountId)

    return respond({ ok: true })
  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
