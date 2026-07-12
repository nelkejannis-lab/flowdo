import { jsonResponse, optionsResponse, requireUser, serviceClient } from '../_shared/auth.ts'

function baseUrl(token: string) {
  return token.startsWith('IGAA')
    ? 'https://graph.instagram.com/v21.0'
    : 'https://graph.facebook.com/v21.0'
}

async function graphGet(token: string, path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
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

function insightValue(data: unknown[] | undefined, name: string): number | undefined {
  const entry = (data ?? []).find((d) => (d as { name?: string }).name === name) as {
    total_value?: { value?: number }
    values?: Array<{ value?: number }>
  } | undefined
  if (!entry) return undefined
  if (entry.total_value && typeof entry.total_value.value === 'number') return entry.total_value.value
  if (Array.isArray(entry.values) && entry.values.length > 0) return entry.values[entry.values.length - 1]?.value
  return undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const auth = await requireUser(req)
  if ('error' in auth) return auth.error

  try {
    const db = serviceClient()
    const body = await req.json().catch(() => ({}))
    const { accountId } = body
    if (!accountId) return jsonResponse({ error: 'accountId fehlt' }, 400)

    const { data: row, error: rowErr } = await db
      .from('social_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (rowErr || !row) return jsonResponse({ error: 'Account nicht gefunden' }, 404)
    if (row.owner_id !== auth.user.id && !(row.shared_with ?? []).includes(auth.user.id)) {
      return jsonResponse({ error: 'Kein Zugriff' }, 403)
    }

    let { ig_user_id: igUserId, access_token: accessToken } = row
    if (!accessToken) return jsonResponse({ error: 'Kein Access Token hinterlegt.' }, 400)

    const token = accessToken.trim()
    const isIgaa = token.startsWith('IGAA')
    const warnings: string[] = []

    let profile: Record<string, unknown>
    try {
      if (isIgaa) {
        profile = await graphGet(token, '/me', {
          fields: 'id,username,name,biography,website,profile_picture_url,followers_count,follows_count,media_count',
          access_token: token,
        })
        igUserId = profile.id as string
      } else {
        profile = await graphGet(token, `/${igUserId}`, {
          fields: 'followers_count,follows_count,media_count,name,biography,website,profile_picture_url',
          access_token: token,
        })
      }
    } catch (e) {
      return jsonResponse({ error: `Profil konnte nicht geladen werden: ${e instanceof Error ? e.message : e}` }, 422)
    }

    await db.from('social_accounts').update({
      ig_user_id: igUserId,
      name: (profile.name as string) ?? null,
      biography: (profile.biography as string) ?? null,
      website: (profile.website as string) ?? null,
      profile_picture_url: (profile.profile_picture_url as string) ?? null,
      username: (profile.username as string) ?? row.username,
    }).eq('id', accountId)

    const today = new Date().toISOString().slice(0, 10)
    const nowTs = Math.floor(Date.now() / 1000)
    const sinceTs = nowTs - 30 * 24 * 3600

    try {
      const ins = await graphGet(token, `/${igUserId}/insights`, {
        metric: 'reach,profile_views,accounts_engaged,follower_count,total_interactions,likes,comments,saves,shares',
        period: 'day',
        since: String(sinceTs),
        until: String(nowTs),
        access_token: token,
      })

      const byDate: Record<string, Record<string, number>> = {}
      for (const entry of (ins.data as Array<{ name: string; values?: Array<{ end_time?: string; value?: number }> }>) ?? []) {
        const name = entry.name
        for (const v of entry.values ?? []) {
          const date = v.end_time?.slice(0, 10)
          if (!date) continue
          if (!byDate[date]) byDate[date] = {}
          byDate[date][name] = v.value ?? 0
        }
      }

      for (const [date, vals] of Object.entries(byDate)) {
        await db.from('social_metrics').upsert({
          account_id: accountId,
          date,
          followers_count: vals['follower_count'] ?? (date === today ? (profile.followers_count as number) ?? null : null),
          follows_count: date === today ? (profile.follows_count as number) ?? null : null,
          media_count: date === today ? (profile.media_count as number) ?? null : null,
          reach: vals['reach'] ?? null,
          profile_views: vals['profile_views'] ?? null,
          accounts_engaged: vals['accounts_engaged'] ?? null,
          total_interactions: vals['total_interactions'] ?? null,
          likes: vals['likes'] ?? null,
          comments: vals['comments'] ?? null,
          saves: vals['saves'] ?? null,
          shares: vals['shares'] ?? null,
        }, { onConflict: 'account_id,date', ignoreDuplicates: false })
      }

      await db.from('social_metrics').upsert({
        account_id: accountId, date: today,
        followers_count: (profile.followers_count as number) ?? null,
        follows_count: (profile.follows_count as number) ?? null,
        media_count: (profile.media_count as number) ?? null,
        reach: byDate[today]?.['reach'] ?? null,
        profile_views: byDate[today]?.['profile_views'] ?? null,
        accounts_engaged: byDate[today]?.['accounts_engaged'] ?? null,
        total_interactions: byDate[today]?.['total_interactions'] ?? null,
        likes: byDate[today]?.['likes'] ?? null,
        comments: byDate[today]?.['comments'] ?? null,
        saves: byDate[today]?.['saves'] ?? null,
        shares: byDate[today]?.['shares'] ?? null,
      }, { onConflict: 'account_id,date' })
    } catch (e) {
      warnings.push(`Account-Insights nicht verfügbar: ${e instanceof Error ? e.message : e}`)
      await db.from('social_metrics').upsert({
        account_id: accountId, date: today,
        followers_count: (profile.followers_count as number) ?? null,
        follows_count: (profile.follows_count as number) ?? null,
        media_count: (profile.media_count as number) ?? null,
      }, { onConflict: 'account_id,date' })
    }

    try {
      const media = await graphGet(token, `/${igUserId}/media`, {
        fields: 'id,caption,media_type,permalink,media_url,thumbnail_url,timestamp,like_count,comments_count',
        limit: '24',
        access_token: token,
      })
      for (const item of (media.data as Array<Record<string, unknown>>) ?? []) {
        let pReach, pSaved, pShares, pTotal
        try {
          const mi = await graphGet(token, `/${item.id}/insights`, {
            metric: 'reach,saved,shares,total_interactions',
            access_token: token,
          })
          pReach = insightValue(mi.data as unknown[], 'reach')
          pSaved = insightValue(mi.data as unknown[], 'saved')
          pShares = insightValue(mi.data as unknown[], 'shares')
          pTotal = insightValue(mi.data as unknown[], 'total_interactions')
        } catch { /* optional */ }

        await db.from('social_posts').upsert({
          account_id: accountId, media_id: item.id as string,
          media_type: (item.media_type as string) ?? null, caption: (item.caption as string) ?? null,
          permalink: (item.permalink as string) ?? null, media_url: (item.media_url as string) ?? null,
          thumbnail_url: (item.thumbnail_url as string) ?? null, posted_at: (item.timestamp as string) ?? null,
          like_count: (item.like_count as number) ?? null, comments_count: (item.comments_count as number) ?? null,
          reach: pReach ?? null, saved: pSaved ?? null, shares: pShares ?? null,
          total_interactions: pTotal ?? null,
        }, { onConflict: 'account_id,media_id' })
      }
    } catch { /* ignore */ }

    try {
      const st = await graphGet(token, `/${igUserId}/stories`, {
        fields: 'id,media_type,timestamp,media_url,thumbnail_url',
        access_token: token,
      })
      for (const item of (st.data as Array<Record<string, unknown>>) ?? []) {
        let imp: number | undefined, sReach: number | undefined, replies: number | undefined,
            exits: number | undefined, tapsF: number | undefined, tapsB: number | undefined
        try {
          const si = await graphGet(token, `/${item.id}/insights`, {
            metric: 'impressions,reach,replies,exits,taps_forward,taps_back',
            access_token: token,
          })
          imp = insightValue(si.data as unknown[], 'impressions')
          sReach = insightValue(si.data as unknown[], 'reach')
          replies = insightValue(si.data as unknown[], 'replies')
          exits = insightValue(si.data as unknown[], 'exits')
          tapsF = insightValue(si.data as unknown[], 'taps_forward')
          tapsB = insightValue(si.data as unknown[], 'taps_back')
        } catch { /* optional */ }

        await db.from('social_stories').upsert({
          account_id: accountId, media_id: item.id as string,
          media_type: (item.media_type as string) ?? null, posted_at: (item.timestamp as string) ?? null,
          media_url: (item.media_url as string) ?? null,
          thumbnail_url: (item.thumbnail_url as string) ?? null,
          impressions: imp ?? null, reach: sReach ?? null, replies: replies ?? null,
          exits: exits ?? null, taps_forward: tapsF ?? null, taps_back: tapsB ?? null,
        }, { onConflict: 'account_id,media_id' })
      }
    } catch { /* ignore */ }

    await db.from('social_accounts')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', accountId)

    return jsonResponse({ ok: true, warnings: warnings.length ? warnings : undefined })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
