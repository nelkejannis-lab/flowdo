const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GRAPH = 'https://graph.facebook.com/v21.0'

async function get(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const { accessToken } = await req.json()
    if (!accessToken) return respond({ error: 'accessToken fehlt' }, 400)

    // 1. Validate token itself via /me
    const me = await get('/me', { fields: 'id,name', access_token: accessToken })
    if (me.error) {
      return respond({
        valid: false,
        error: `Token ungültig: ${me.error.message} (Code ${me.error.code})`,
      })
    }

    // 2. Get all Facebook Pages connected to this token
    const accounts = await get('/me/accounts', {
      fields: 'id,name,instagram_business_account{id,name,username,profile_picture_url,followers_count}',
      access_token: accessToken,
    })

    const igAccounts: { pageId: string; pageName: string; igUserId: string; igUsername: string; igName: string; profilePic?: string; followers?: number }[] = []

    for (const page of accounts.data ?? []) {
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account
        igAccounts.push({
          pageId: page.id,
          pageName: page.name,
          igUserId: ig.id,
          igUsername: ig.username ?? '',
          igName: ig.name ?? '',
          profilePic: ig.profile_picture_url,
          followers: ig.followers_count,
        })
      }
    }

    return respond({ valid: true, meId: me.id, meName: me.name, igAccounts })
  } catch (err) {
    return respond({ error: String(err) }, 500)
  }
})
