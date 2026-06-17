const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GRAPH = 'https://graph.facebook.com/v21.0'

async function gget(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}${path}`)
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
    const isIgaaToken = token.startsWith('IGAA')

    // IGAA tokens: Instagram Business Login flow — token IS the IG user token directly
    // Try to get the IG user info directly using the token as the user ID lookup
    if (isIgaaToken) {
      // With IGAA tokens we query /me on the Instagram endpoint
      const me = await gget('/me', {
        fields: 'id,name,username,followers_count,profile_picture_url',
        access_token: token,
      })

      if (me.error) {
        // Try /me/accounts style — IGAA tokens may be page-scoped
        const steps = [{ label: 'Token-Typ', ok: true, detail: 'IGAA-Token erkannt (neues Instagram Business Login Format)' }]
        steps.push({ label: 'Token-Validierung', ok: false, detail: `${me.error.message} (Code ${me.error.code})` })
        steps.push({
          label: 'Lösung', ok: false,
          detail: 'IGAA-Tokens werden über die neue Instagram Business Login API generiert. Stelle sicher dass du im Graph API Explorer unter "User or Page" → "User Token" ausgewählt hast, NICHT "Page Token". Alternativ: nutze einen EAA-Token über den klassischen Facebook Login.',
        })
        return respond({ valid: false, steps, igAccounts: [] })
      }

      // me.id is the IG Business Account ID directly
      const steps = [
        { label: 'Token-Typ', ok: true, detail: 'IGAA-Token (Instagram Business Login)' },
        { label: 'Instagram Account', ok: true, detail: `@${me.username ?? me.name} (ID: ${me.id}, ${me.followers_count ?? '?'} Follower)` },
      ]

      return respond({
        valid: true,
        steps,
        igAccounts: [{
          igUserId: me.id,
          igUsername: me.username ?? '',
          igName: me.name ?? '',
          profilePic: me.profile_picture_url,
          followers: me.followers_count,
        }],
      })
    }

    // EAA tokens: classic Facebook User Access Token flow
    const me = await gget('/me', { fields: 'id,name', access_token: token })
    const steps: { label: string; ok: boolean; detail: string }[] = []

    if (me.error) {
      steps.push({ label: 'Token-Validierung', ok: false, detail: `${me.error.message} (Code ${me.error.code})` })
      return respond({ valid: false, steps, igAccounts: [] })
    }
    steps.push({ label: 'Token-Validierung', ok: true, detail: `Eingeloggt als: ${me.name} (ID: ${me.id})` })

    // Check permissions
    const perms = await gget('/me/permissions', { access_token: token })
    const granted: string[] = (perms.data ?? []).filter((p: any) => p.status === 'granted').map((p: any) => p.permission)
    const needed = ['instagram_basic', 'instagram_manage_insights', 'pages_show_list', 'pages_read_engagement']
    const missing = needed.filter((p) => !granted.includes(p))
    steps.push(missing.length > 0
      ? { label: 'Berechtigungen', ok: false, detail: `Fehlend: ${missing.join(', ')}` }
      : { label: 'Berechtigungen', ok: true, detail: 'Alle Berechtigungen vorhanden' }
    )

    // Facebook Pages + linked IG accounts
    const pages = await gget('/me/accounts', {
      fields: 'id,name,instagram_business_account{id,name,username,followers_count,profile_picture_url}',
      access_token: token,
    })

    if (pages.error) {
      steps.push({ label: 'Facebook Seiten', ok: false, detail: pages.error.message })
      return respond({ valid: true, steps, igAccounts: [] })
    }

    const pageList = pages.data ?? []
    if (pageList.length === 0) {
      steps.push({ label: 'Facebook Seiten', ok: false, detail: 'Keine Facebook-Seiten gefunden — du brauchst eine Seite als Admin.' })
      return respond({ valid: true, steps, igAccounts: [] })
    }

    const igAccounts: object[] = []
    for (const page of pageList) {
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account
        igAccounts.push({ igUserId: ig.id, igUsername: ig.username ?? '', igName: ig.name ?? '', profilePic: ig.profile_picture_url, followers: ig.followers_count })
      }
    }

    steps.push(igAccounts.length === 0
      ? { label: 'Instagram Business', ok: false, detail: 'Keine IG Business/Creator Accounts mit den Seiten verknüpft. Wechsle auf Instagram zu "Professionelles Konto" und verknüpfe es mit deiner Facebook-Seite.' }
      : { label: 'Instagram Business', ok: true, detail: `${igAccounts.length} Account(s) gefunden` }
    )

    return respond({ valid: igAccounts.length > 0, steps, igAccounts })
  } catch (err) {
    return respond({ error: String(err) }, 500)
  }
})
