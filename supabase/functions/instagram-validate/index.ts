import { jsonResponse, optionsResponse, requireUser } from '../_shared/auth.ts'

async function gget(baseUrl: string, path: string, params: Record<string, string>) {
  const url = new URL(`${baseUrl}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  return await res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const auth = await requireUser(req)
  if ('error' in auth) return auth.error

  try {
    const { accessToken } = await req.json()
    if (!accessToken) return jsonResponse({ error: 'accessToken fehlt' }, 400)

    const token = accessToken.trim()
    const isIgaa = token.startsWith('IGAA')
    const steps: { label: string; ok: boolean; detail: string }[] = []

    if (isIgaa) {
      steps.push({ label: 'Token-Typ', ok: true, detail: 'IGAA-Token erkannt (Instagram Business Login)' })

      const me = await gget('https://graph.instagram.com/v21.0', '/me', {
        fields: 'id,username,name,followers_count,profile_picture_url,biography,website',
        access_token: token,
      })

      if (me.error) {
        steps.push({ label: 'Instagram Account', ok: false, detail: `${me.error.message} (Code ${me.error.code})` })
        return jsonResponse({ valid: false, steps, igAccounts: [] })
      }

      steps.push({
        label: 'Instagram Account',
        ok: true,
        detail: `@${me.username ?? me.name} (ID: ${me.id}${me.followers_count ? ', ' + me.followers_count + ' Follower' : ''})`,
      })

      return jsonResponse({
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

    steps.push({ label: 'Token-Typ', ok: true, detail: 'EAA-Token (Facebook Graph API)' })

    const me = await gget('https://graph.facebook.com/v21.0', '/me', {
      fields: 'id,name',
      access_token: token,
    })

    if (me.error) {
      steps.push({ label: 'Token-Validierung', ok: false, detail: `${me.error.message} (Code ${me.error.code})` })
      return jsonResponse({ valid: false, steps, igAccounts: [] })
    }
    steps.push({ label: 'Token-Validierung', ok: true, detail: `Eingeloggt als: ${me.name}` })

    const pages = await gget('https://graph.facebook.com/v21.0', '/me/accounts', {
      fields: 'id,name,instagram_business_account{id,name,username,followers_count,profile_picture_url}',
      access_token: token,
    })

    if (pages.error) {
      steps.push({ label: 'Facebook Seiten', ok: false, detail: pages.error.message })
      return jsonResponse({ valid: true, steps, igAccounts: [] })
    }

    const pageList = pages.data ?? []
    if (pageList.length === 0) {
      steps.push({ label: 'Facebook Seiten', ok: false, detail: 'Keine Facebook-Seiten gefunden.' })
      return jsonResponse({ valid: true, steps, igAccounts: [] })
    }
    steps.push({ label: 'Facebook Seiten', ok: true, detail: pageList.map((p: { name: string }) => p.name).join(', ') })

    const igAccounts: object[] = []
    for (const page of pageList) {
      if (page.instagram_business_account) {
        const ig = page.instagram_business_account
        igAccounts.push({ igUserId: ig.id, igUsername: ig.username ?? '', igName: ig.name ?? '', profilePic: ig.profile_picture_url, followers: ig.followers_count })
      }
    }

    steps.push(igAccounts.length === 0
      ? { label: 'Instagram Business', ok: false, detail: 'Keine IG Business/Creator Accounts gefunden.' }
      : { label: 'Instagram Business', ok: true, detail: `${igAccounts.length} Account(s) gefunden` }
    )

    return jsonResponse({ valid: igAccounts.length > 0, steps, igAccounts })
  } catch (err) {
    return jsonResponse({ error: String(err) }, 500)
  }
})
