import { createOAuthState } from '../_shared/oauthState.ts'
import { jsonResponse, optionsResponse, requireUser } from '../_shared/auth.ts'

const callbackBase = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-oauth-callback`

async function buildRedirect(provider: string, userId: string): Promise<string> {
  const signedState = await createOAuthState(provider, userId)

  if (provider === 'google') {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set')

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackBase(),
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      prompt: 'consent',
      state: signedState,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  }

  if (provider === 'microsoft') {
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
    if (!clientId) throw new Error('MICROSOFT_CLIENT_ID not set')

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackBase(),
      response_type: 'code',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
      state: signedState,
    })
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`
  }

  throw new Error('Unknown provider')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return optionsResponse()

  const auth = await requireUser(req)
  if ('error' in auth) return auth.error

  try {
    let provider: string | null = null

    if (req.method === 'POST') {
      const body = await req.json()
      provider = body.provider ?? null
    } else {
      const url = new URL(req.url)
      provider = url.searchParams.get('provider')
    }

    if (!provider || (provider !== 'google' && provider !== 'microsoft')) {
      return jsonResponse({ error: 'Unknown provider' }, 400)
    }

    const redirectUrl = await buildRedirect(provider, auth.user.id)
    if (req.method === 'POST') {
      return jsonResponse({ redirectUrl })
    }
    return Response.redirect(redirectUrl, 302)
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'OAuth start failed' }, 500)
  }
})
