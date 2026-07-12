const encoder = new TextEncoder()

function stateSecret(): string {
  return Deno.env.get('OAUTH_STATE_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'change-me'
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(stateSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function verify(payload: string, signature: string): Promise<boolean> {
  const expected = await sign(payload)
  return expected === signature
}

/** Signed OAuth state: provider:userId:expiresAt:signature */
export async function createOAuthState(provider: string, userId: string): Promise<string> {
  const expiresAt = Date.now() + 10 * 60 * 1000
  const payload = `${provider}:${userId}:${expiresAt}`
  const signature = await sign(payload)
  return `${payload}:${signature}`
}

export async function parseOAuthState(state: string): Promise<{ provider: string; userId: string } | null> {
  const parts = state.split(':')
  if (parts.length < 4) return null

  const signature = parts.pop()!
  const expiresAt = Number(parts.pop())
  const userId = parts.pop()!
  const provider = parts.join(':')
  const payload = `${provider}:${userId}:${expiresAt}`

  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null
  if (!(await verify(payload, signature))) return null

  return { provider, userId }
}
