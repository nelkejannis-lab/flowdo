import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseOAuthState } from '../_shared/oauthState.ts'

const APP_URL = 'https://mooncrew.app/einstellungen?tab=kalender'
const callbackBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-oauth-callback`

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error || !code || !state) {
    return Response.redirect(`${APP_URL}&error=${error ?? 'missing_params'}`)
  }

  const parsed = await parseOAuthState(state)
  if (!parsed) {
    return Response.redirect(`${APP_URL}&error=invalid_state`)
  }

  const { provider, userId } = parsed

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    let accessToken: string
    let refreshToken: string | null = null
    let expiresAt: Date | null = null
    let email: string | null = null
    let displayName: string | null = null

    if (provider === 'google') {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          redirect_uri: callbackBase,
          grant_type: 'authorization_code',
        }),
      })
      const tokens = await tokenRes.json()
      if (tokens.error) throw new Error(tokens.error_description ?? tokens.error)

      accessToken = tokens.access_token
      refreshToken = tokens.refresh_token ?? null
      expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null

      const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const info = await infoRes.json()
      email = info.email
      displayName = info.name
    } else if (provider === 'microsoft') {
      const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: Deno.env.get('MICROSOFT_CLIENT_ID')!,
          client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')!,
          redirect_uri: callbackBase,
          grant_type: 'authorization_code',
          scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
        }),
      })
      const tokens = await tokenRes.json()
      if (tokens.error) throw new Error(tokens.error_description ?? tokens.error)

      accessToken = tokens.access_token
      refreshToken = tokens.refresh_token ?? null
      expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null

      const infoRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const info = await infoRes.json()
      email = info.mail ?? info.userPrincipalName
      displayName = info.displayName
    } else {
      return Response.redirect(`${APP_URL}&error=unknown_provider`)
    }

    await supabase.from('calendar_connections').upsert({
      user_id: userId,
      provider,
      access_token: accessToken!,
      refresh_token: refreshToken,
      token_expires_at: expiresAt?.toISOString() ?? null,
      email,
      display_name: displayName,
    }, { onConflict: 'user_id,provider' })

    return Response.redirect(`${APP_URL}&connected=${provider}`)
  } catch (err) {
    return Response.redirect(`${APP_URL}&error=${encodeURIComponent(err instanceof Error ? err.message : 'unknown')}`)
  }
})
