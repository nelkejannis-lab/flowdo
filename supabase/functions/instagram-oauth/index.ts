import { jsonResponse, optionsResponse, requireUser, serviceClient } from '../_shared/auth.ts'

const REDIRECT_URI = 'https://novat.app/instagram-callback'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const auth = await requireUser(req)
  if ('error' in auth) return auth.error

  try {
    const APP_ID = Deno.env.get('INSTAGRAM_APP_ID')!
    const APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET')!

    const { code, accountId } = await req.json()
    if (!code) return jsonResponse({ error: 'code fehlt' }, 400)

    const bodyStr = `client_id=${APP_ID}&client_secret=${APP_SECRET}&grant_type=authorization_code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&code=${encodeURIComponent(code)}`

    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyStr,
    })
    const shortText = await shortRes.text()
    const shortJson = JSON.parse(shortText)

    if (shortJson.error_type || shortJson.error) {
      const msg = shortJson.error_message ?? shortJson.error?.message ?? 'Token-Austausch fehlgeschlagen'
      return jsonResponse({ error: msg }, 422)
    }

    const shortToken = shortJson.access_token
    const igUserId = shortJson.user_id?.toString()

    const longUrl = new URL('https://graph.instagram.com/access_token')
    longUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longUrl.searchParams.set('client_id', APP_ID)
    longUrl.searchParams.set('client_secret', APP_SECRET)
    longUrl.searchParams.set('access_token', shortToken)

    const longRes = await fetch(longUrl.toString())
    const longJson = await longRes.json()

    if (longJson.error) {
      return jsonResponse({ error: longJson.error.message ?? 'Long-Lived Token fehlgeschlagen' }, 422)
    }

    const accessToken = longJson.access_token

    const meUrl = new URL('https://graph.instagram.com/v21.0/me')
    meUrl.searchParams.set('fields', 'id,username,name,biography,website,profile_picture_url,followers_count')
    meUrl.searchParams.set('access_token', accessToken)
    const meRes = await fetch(meUrl.toString())
    const me = await meRes.json()

    const db = serviceClient()

    if (accountId) {
      const { data: account } = await db
        .from('social_accounts')
        .select('owner_id')
        .eq('id', accountId)
        .single()

      if (!account || account.owner_id !== auth.user.id) {
        return jsonResponse({ error: 'Account nicht gefunden' }, 404)
      }

      await db.from('social_accounts').update({
        access_token: accessToken,
        token_configured: true,
        ig_user_id: igUserId ?? me.id,
        username: me.username ?? undefined,
      }).eq('id', accountId)
    } else {
      await db.from('social_accounts').insert({
        owner_id: auth.user.id,
        platform: 'instagram',
        username: me.username ?? String(igUserId ?? me.id),
        ig_user_id: igUserId ?? me.id,
        access_token: accessToken,
        token_configured: true,
        name: me.name ?? null,
      })
    }

    return jsonResponse({
      ok: true,
      igUserId: igUserId ?? me.id,
      username: me.username ?? '',
      name: me.name ?? '',
      followers: me.followers_count,
    })
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
