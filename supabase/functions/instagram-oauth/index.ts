import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const APP_ID = Deno.env.get('INSTAGRAM_APP_ID')!
    const APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET')!
    const REDIRECT_URI = 'https://mooncrew.app/instagram-callback'

    const { code, accountId } = await req.json()
    if (!code) return respond({ error: 'code fehlt' }, 400)

    // 1. Exchange code for short-lived token
    const form = new FormData()
    form.append('client_id', APP_ID)
    form.append('client_secret', APP_SECRET)
    form.append('grant_type', 'authorization_code')
    form.append('redirect_uri', REDIRECT_URI)
    form.append('code', code)

    const shortRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      body: form,
    })
    const shortJson = await shortRes.json()

    if (shortJson.error_type || shortJson.error) {
      const msg = shortJson.error_message ?? shortJson.error?.message ?? 'Token-Austausch fehlgeschlagen'
      return respond({ error: msg }, 422)
    }

    const shortToken = shortJson.access_token
    const igUserId = shortJson.user_id?.toString()

    // 2. Exchange for long-lived token (60 days)
    const longUrl = new URL('https://graph.instagram.com/access_token')
    longUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longUrl.searchParams.set('client_id', APP_ID)
    longUrl.searchParams.set('client_secret', APP_SECRET)
    longUrl.searchParams.set('access_token', shortToken)

    const longRes = await fetch(longUrl.toString())
    const longJson = await longRes.json()

    if (longJson.error) {
      return respond({ error: longJson.error.message ?? 'Long-Lived Token fehlgeschlagen' }, 422)
    }

    const accessToken = longJson.access_token

    // 3. Fetch profile
    const meUrl = new URL('https://graph.instagram.com/v21.0/me')
    meUrl.searchParams.set('fields', 'id,username,name,biography,website,profile_picture_url,followers_count')
    meUrl.searchParams.set('access_token', accessToken)
    const meRes = await fetch(meUrl.toString())
    const me = await meRes.json()

    // 4. If accountId given, update existing account; else return token info for new account
    if (accountId) {
      const db = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await db.from('social_accounts').update({
        access_token: accessToken,
        ig_user_id: igUserId ?? me.id,
        username: me.username ?? undefined,
      }).eq('id', accountId)
    }

    return respond({
      ok: true,
      accessToken,
      igUserId: igUserId ?? me.id,
      username: me.username ?? '',
      name: me.name ?? '',
      followers: me.followers_count,
    })
  } catch (err) {
    return respond({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
