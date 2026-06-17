const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function gget(baseUrl: string, path: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  return await res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const { accessToken } = await req.json()
    if (!accessToken) return respond({ error: 'accessToken fehlt' }, 400)

    const token = accessToken.trim()
    const isIgaa = token.startsWith('IGAA')
    const steps: { label: string; ok: boolean; detail: string }[] = []

    if (isIgaa) {
      // New Instagram Business Login API — uses graph.instagram.com
      steps.push({ label: 'Token-Typ', ok: true, detail: 'IGAA-Token erkannt (Instagram Business Login)' })

      const me = await gget('https://graph.instagram.com/v21.0', '/me', {
        fields: 'id,username,name,followers_count,profile_picture_url,biography,website',
        access_token: token,
      })

      if (me.error) {
        steps.push({ label: 'Instagram Account', ok: false, detail: `${me.error.message} (Code ${me.error.code})` })
        steps.push({
          label: 'Hinweis', ok: false,
          detail: 'Stelle sicher dass du in der App unter "Instagram API with Instagram Login" (nicht "Instagram Graph API") die Berechtigung instagram_business_basic aktiviert hast.',
        })
        return respond({ valid: false, steps, igAccounts: [] })
      }

      steps.push({
        label: 'Instagram Account',
        ok: true,
        detail: `@${me.username ?? me.name} (ID: ${me.id}${me.followers_count ? ', ' + me.followers_count + ' Follower' : ''})`,
      })

      return respond({
        valid: true,
        steps,
        igAccounts: [{
          igUserId: me.id,
          igUsername: me.username ?? '',
          igName: me.name ?? '',
          profilePic: me.profile_picture_url,
          followers: me.followers_count,
          biography: me.biography,
          website: me.website,
        }],
      })
    }

    // EAA tokens — classic Facebook Graph API flow
    steps.push({ label: 'Token-Typ', ok: true, detail: 'EAA-Token (Facebook Graph API)' })

    const me = await gget('https://graph.facebook.com/v21.0', '/me', {
      fields: 'id,name',
      access_token: token,
    })

    if (me.error) {
      steps.push({ label: 'Token-Validierung', ok: false, detail: `${me.error.message} (Code ${me.error.code})` })
      return respond({ valid: false, steps, igAccounts: [] })
    }
    steps.push({ label: 'Token-Validierung', ok: true, detail: `Eingeloggt als: ${me.name}` })

    const pages = await gget('https://graph.facebook.com/v21.0', '/me/accounts', {
      fields: 'id,name,instagram_business_account{id,name,username,followers_count,profile_picture_url}',
      access_token: token,
    })

    if (pages.error) {
      steps.push({ label: 'Facebook Seiten', ok: false, detail: pages.error.message })
      return respond({ valid: true, steps, igAccounts: [] })
    }

    const pageList = pages.data ?? []
    if (pageList.length === 0) {
      steps.push({ label: 'Facebook Seiten', ok: false, detail: 'Keine Facebook-Seiten gefunden. Du brauchst eine Facebook-Seite als Admin.' })
      return respond({ valid: true, steps, igAccounts: [] })
    }
    steps.push({ label: 'Facebook Seiten', ok: true, detail: pageList.map((p: any) => p.name).join(', ') })

    const igAccounts: object[] = []
    for (const page of pageList) {
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account
        igAccounts.push({ igUserId: ig.id, igUsername: ig.username ?? '', igName: ig.name ?? '', profilePic: ig.profile_picture_url, followers: ig.followers_count })
      }
    }

    steps.push(igAccounts.length === 0
      ? { label: 'Instagram Business', ok: false, detail: 'Keine IG Business/Creator Accounts mit deinen Seiten verknüpft. Instagram → Profil → "Professionelles Konto" → dann mit Facebook-Seite verbinden.' }
      : { label: 'Instagram Business', ok: true, detail: `${igAccounts.length} Account(s) gefunden` }
    )

    return respond({ valid: igAccounts.length > 0, steps, igAccounts })
  } catch (err) {
    return respond({ error: String(err) }, 500)
  }
})
