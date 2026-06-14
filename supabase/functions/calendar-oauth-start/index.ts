// Redirects the user to the OAuth provider's login page
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  const provider = url.searchParams.get('provider')
  const userId = url.searchParams.get('user_id')

  const callbackBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendar-oauth-callback`

  if (provider === 'google') {
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
    if (!clientId) return new Response('GOOGLE_CLIENT_ID not set', { status: 500 })

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackBase,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      access_type: 'offline',
      prompt: 'consent',
      state: `google:${userId}`,
    })
    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  }

  if (provider === 'microsoft') {
    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID')
    if (!clientId) return new Response('MICROSOFT_CLIENT_ID not set', { status: 500 })

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackBase,
      response_type: 'code',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
      state: `microsoft:${userId}`,
    })
    return Response.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`)
  }

  return new Response('Unknown provider', { status: 400 })
})
