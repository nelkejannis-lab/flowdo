import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// IGAA tokens use graph.instagram.com, EAA tokens use graph.facebook.com
function baseUrl(token: string) {
  return token.startsWith('IGAA')
    ? 'https://graph.instagram.com/v21.0'
    : 'https://graph.facebook.com/v21.0'
}

async function graphGet(token: string, path: string, params: Record<string, string>): Promise<any> {
  const url = new URL(`${baseUrl(token)}${path}`)
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
    if (!accessToken) return respond({ error: 'Kein Access Token hinterlegt.' }, 400)

    const token = accessToken.trim()
    const isIgaa = token.startsWith('IGAA')

    // ── 1. Profile ──────────────────────────────────────────────────────────
    let profile: any
    try {
      if (isIgaa) {
        // New Instagram Business Login: /me returns IG account directly
        profile = await graphGet(token, '/me', {
          fields: 'id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count',
          access_token: token,
        })
        igUserId = profile.id // auto-update igUserId from token
      } else {
        profile = await graphGet(token, `/${igUserId}`, {
          fields: 'followers_count,follows_count,media_count,name,biography,website,profile_picture_url',
          access_token: token,
        })
      }
    } catch (e: any) {
      return respond({ error: `Profil konnte nicht geladen werden: ${e.message}` }, 422)
    }

    await db.from('social_accounts').update({
      ig_user_id: igUserId,
      name: profile.name ?? null,
      biography: profile.biography ?? null,
      website: profile.website ?? null,
      profile_picture_url: profile.profile_picture_url ?? null,
      username: profile.username ?? row.username,
    }).eq('id', accountId)

    // ── 2. Account insights (today + 30-day historical backfill) ───────────
    const warnings: string[] = []
    const today = new Date().toISOString().slice(0, 10)
    const nowTs = Math.floor(Date.now() / 1000)
    const sinceTs = nowTs - 30 * 24 * 3600

    try {
      // Historical daily data for last 30 days
      // Only these metrics support true daily time-series with since/until:
      const ins = await graphGet(token, `/${igUserId}/insights`, {
        metric: 'reach,profile_views,accounts_engaged,impressions,follower_count',
        period: 'day',
        since: String(sinceTs),
        until: String(nowTs),
        access_token: token,
      })

      // Build per-date map from the values arrays
      const byDate: Record<string, Record<string, number>> = {}
      for (const entry of ins.data ?? []) {
        const name: string = entry.name
        for (const v of entry.values ?? []) {
          const date: string = v.end_time?.slice(0, 10)
          if (!date) continue
          if (!byDate[date]) byDate[date] = {}
          byDate[date][name] = v.value ?? 0
        }
      }

      // Upsert each day
      for (const [date, vals] of Object.entries(byDate)) {
        await db.from('social_metrics').upsert({
          account_id: accountId,
          date,
          followers_count: vals['follower_count'] != null ? vals['follower_count'] : (date === today ? (profile.followers_count ?? null) : null),
          follows_count: date === today ? (profile.follows_count ?? null) : null,
          media_count: date === today ? (profile.media_count ?? null) : null,
          reach: vals['reach'] ?? null,
          profile_views: vals['profile_views'] ?? null,
          accounts_engaged: vals['accounts_engaged'] ?? null,
        }, { onConflict: 'account_id,date', ignoreDuplicates: false })
      }

      // Fetch today's engagement metrics (likes/comments/saves/shares) separately
      // These are not available in historical time-series but work for today with period=day
      let todayLikes: number | null = null, todayComments: number | null = null
      let todaySaves: number | null = null, todayShares: number | null = null
      let todayTotal: number | null = null
      try {
        const todayIns = await graphGet(token, `/${igUserId}/insights`, {
          metric: 'total_interactions,likes,comments,saved,shares',
          period: 'day',
          access_token: token,
        })
        todayTotal = insightValue(todayIns.data, 'total_interactions') ?? null
        todayLikes = insightValue(todayIns.data, 'likes') ?? null
        todayComments = insightValue(todayIns.data, 'comments') ?? null
        todaySaves = insightValue(todayIns.data, 'saved') ?? null
        todayShares = insightValue(todayIns.data, 'shares') ?? null
      } catch { /* engagement metrics may not be available */ }

      // Ensure today always has full data
      await db.from('social_metrics').upsert({
        account_id: accountId, date: today,
        followers_count: profile.followers_count ?? null,
        follows_count: profile.follows_count ?? null,
        media_count: profile.media_count ?? null,
        reach: byDate[today]?.['reach'] ?? null,
        profile_views: byDate[today]?.['profile_views'] ?? null,
        accounts_engaged: byDate[today]?.['accounts_engaged'] ?? null,
        total_interactions: todayTotal,
        likes: todayLikes,
        comments: todayComments,
        shares: todayShares,
        saves: todaySaves,
      }, { onConflict: 'account_id,date' })

    } catch (e: any) {
      warnings.push(`Account-Insights nicht verfügbar: ${e.message}. Benötigt Berechtigung "instagram_business_manage_insights".`)
      // Fallback: save today with just profile data
      await db.from('social_metrics').upsert({
        account_id: accountId, date: today,
        followers_count: profile.followers_count ?? null,
        follows_count: profile.follows_count ?? null,
        media_count: profile.media_count ?? null,
      }, { onConflict: 'account_id,date' })
    }

    // ── 3. Posts ────────────────────────────────────────────────────────────
    try {
      const media = await graphGet(token, `/${igUserId}/media`, {
        fields: 'id,caption,media_type,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count',
        limit: '24',
        access_token: token,
      })
      for (const item of media.data ?? []) {
        let pReach, pSaved, pShares, pTotal
        try {
          const mi = await graphGet(token, `/${item.id}/insights`, {
            metric: 'reach,saved,shares,total_interactions',
            access_token: token,
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
      const st = await graphGet(token, `/${igUserId}/stories`, {
        fields: 'id,media_type,timestamp,media_url,thumbnail_url',
        access_token: token,
      })
      for (const item of st.data ?? []) {
        let imp: number | undefined, sReach: number | undefined, replies: number | undefined,
            exits: number | undefined, tapsF: number | undefined, tapsB: number | undefined
        try {
          const si = await graphGet(token, `/${item.id}/insights`, {
            metric: 'impressions,reach,replies,exits,taps_forward,taps_back',
            access_token: token,
          })
          imp = insightValue(si.data, 'impressions')
          sReach = insightValue(si.data, 'reach')
          replies = insightValue(si.data, 'replies')
          exits = insightValue(si.data, 'exits')
          tapsF = insightValue(si.data, 'taps_forward')
          tapsB = insightValue(si.data, 'taps_back')
        } catch { /* story insights may be unavailable */ }

        await db.from('social_stories').upsert({
          account_id: accountId, media_id: item.id,
          media_type: item.media_type ?? null, posted_at: item.timestamp ?? null,
          media_url: item.media_url ?? null,
          thumbnail_url: item.thumbnail_url ?? null,
          impressions: imp ?? null, reach: sReach ?? null, replies: replies ?? null,
          exits: exits ?? null, taps_forward: tapsF ?? null, taps_back: tapsB ?? null,
        }, { onConflict: 'account_id,media_id' })
      }
    } catch { /* ignore story failures */ }

    await db.from('social_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', accountId)

    return respond({ ok: true, warnings: warnings.length ? warnings : undefined })
  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
