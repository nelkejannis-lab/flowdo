import { useAuthStore } from '../store/authStore'
import { NOVA_PUBLIC } from '../config/novaPublic'
import { isSupabaseConfigured, supabase } from './supabase'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_TTL_MS = 15 * 60 * 1000
const JOIN_OVERRIDE_KEY = 'novat.whatsapp.sandboxJoin'

export function novaApiAvailable() {
  return isSupabaseConfigured
}

export function friendlyNetworkError(err: unknown, fallbackDe: string, fallbackEn?: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const isDe =
    typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('de')
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(raw)) {
    return isDe
      ? 'Verbindung fehlgeschlagen. Prüfe Internet und ob du angemeldet bist.'
      : (fallbackEn ?? 'Connection failed. Check your internet and that you are signed in.')
  }
  if (raw.trim()) return raw
  return isDe ? fallbackDe : (fallbackEn ?? fallbackDe)
}

export interface WhatsAppLinkStatusResult {
  linked: boolean
  linkedPhone?: string | null
  linkCode?: string | null
  linkCodeExpiresAt?: string | null
  remainingAttempts?: number | null
  sandboxMode?: boolean
  sandboxJoinCode?: string | null
  joinConfigured?: boolean
  botNumber?: string | null
  hint?: string | null
  error?: string
}

type LinkCodeRow = {
  code: string
  expires_at: string
  attempt_count: number
  max_attempts: number
  consumed_at: string | null
}

function makeLinkCode(): string {
  let suffix = ''
  for (let i = 0; i < 6; i++) {
    suffix += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return `NOVAT-${suffix}`
}

function mapActiveCode(row: LinkCodeRow | null | undefined): Pick<
  WhatsAppLinkStatusResult,
  'linkCode' | 'linkCodeExpiresAt' | 'remainingAttempts'
> {
  if (!row || row.consumed_at) return {}
  if (new Date(row.expires_at).getTime() <= Date.now()) return {}
  return {
    linkCode: row.code,
    linkCodeExpiresAt: row.expires_at,
    remainingAttempts: Math.max(0, row.max_attempts - row.attempt_count),
  }
}

async function requireUserId(): Promise<{ userId: string } | { error: string }> {
  const fromStore = useAuthStore.getState().user?.id
  if (fromStore) return { userId: fromStore }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return {
      error:
        typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('de')
          ? 'Bitte melde dich an, um WhatsApp zu verknüpfen.'
          : 'Please sign in to link WhatsApp.',
    }
  }
  return { userId: data.user.id }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

async function fetchActiveLinkCode(userId: string): Promise<LinkCodeRow | null> {
  const { data, error } = await supabase
    .from('whatsapp_link_codes')
    .select('code, expires_at, attempt_count, max_attempts, consumed_at')
    .eq('user_id', userId)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as LinkCodeRow | null) ?? null
}

export interface WhatsAppConnectInfo {
  botNumber: string
  sandboxMode: boolean
  sandboxJoinCode: string | null
  joinConfigured?: boolean
  sandboxJoinExpiresHours?: number
  waMeBot?: string
  hint?: string | null
}

/** Digits-only E.164 without + for wa.me links. */
export function whatsappWaMeNumber(botNumber?: string | null): string {
  const raw = (botNumber || NOVA_PUBLIC.whatsappBotNumber || '+14155238886').replace(/\D/g, '')
  return raw || '14155238886'
}

export function whatsappDeepLink(text: string, botNumber?: string | null): string {
  const digits = whatsappWaMeNumber(botNumber)
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/**
 * Build WhatsApp prefill / clipboard text.
 * Join always comes first when included, then NOVAT code on the next line.
 * - Step 1 only: `join keyword`
 * - Step 2 after joined: `NOVAT-XXXXXX`
 * - Combined: `join keyword\nNOVAT-XXXXXX`
 */
export function composeWhatsAppConnectText(options: {
  joinCode?: string | null
  linkCode?: string | null
  /** When false, omit join even if joinCode is set. Default: include join when present. */
  includeJoin?: boolean
}): string {
  const includeJoin = options.includeJoin !== false
  const join = includeJoin ? normalizeSandboxJoin(options.joinCode) : null
  const code = String(options.linkCode || '').trim() || null
  return [join, code].filter(Boolean).join('\n')
}

/** Normalize join phrase to always start with "join ". */
export function normalizeSandboxJoin(code: string | null | undefined): string | null {
  const raw = String(code || '').trim()
  if (!raw) return null
  return /^join\s+/i.test(raw) ? raw.replace(/^join\s+/i, 'join ') : `join ${raw}`
}

export function getLocalSandboxJoinOverride(): string | null {
  try {
    return normalizeSandboxJoin(localStorage.getItem(JOIN_OVERRIDE_KEY))
  } catch {
    return null
  }
}

export function setLocalSandboxJoinOverride(code: string | null): string | null {
  const normalized = normalizeSandboxJoin(code)
  try {
    if (normalized) localStorage.setItem(JOIN_OVERRIDE_KEY, normalized)
    else localStorage.removeItem(JOIN_OVERRIDE_KEY)
  } catch {
    // ignore storage restrictions
  }
  return normalized
}

let cachedConnectInfo: WhatsAppConnectInfo | null = null
let connectInfoFetchedAt = 0

export function clearWhatsAppConnectInfoCache() {
  cachedConnectInfo = null
  connectInfoFetchedAt = 0
}

export async function apiGetWhatsAppConnectInfo(force = false): Promise<WhatsAppConnectInfo> {
  const fallback: WhatsAppConnectInfo = {
    botNumber: NOVA_PUBLIC.whatsappBotNumber,
    sandboxMode: NOVA_PUBLIC.whatsappSandboxMode,
    sandboxJoinCode: normalizeSandboxJoin(NOVA_PUBLIC.whatsappSandboxJoinCode),
    joinConfigured: !!normalizeSandboxJoin(NOVA_PUBLIC.whatsappSandboxJoinCode),
  }
  if (!force && cachedConnectInfo && Date.now() - connectInfoFetchedAt < 30_000) {
    return cachedConnectInfo
  }
  try {
    const res = await fetch(`${NOVA_PUBLIC.serverUrl}/api/whatsapp/connect-info`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return fallback
    const data = (await res.json()) as Partial<WhatsAppConnectInfo>
    const join = normalizeSandboxJoin(data.sandboxJoinCode) ?? fallback.sandboxJoinCode
    cachedConnectInfo = {
      botNumber: data.botNumber || fallback.botNumber,
      sandboxMode: data.sandboxMode ?? fallback.sandboxMode,
      sandboxJoinCode: join,
      joinConfigured: data.joinConfigured ?? !!join,
      sandboxJoinExpiresHours: data.sandboxJoinExpiresHours ?? 72,
      waMeBot: data.waMeBot,
      hint: data.hint ?? null,
    }
    connectInfoFetchedAt = Date.now()
    return cachedConnectInfo
  } catch {
    return fallback
  }
}

async function buildWhatsAppStatus(userId: string, forceConnectInfo = false): Promise<WhatsAppLinkStatusResult> {
  const [{ data: profile, error: profileError }, activeCode, connectInfo] = await Promise.all([
    supabase.from('profiles').select('phone_number').eq('id', userId).maybeSingle(),
    fetchActiveLinkCode(userId),
    apiGetWhatsAppConnectInfo(forceConnectInfo),
  ])

  if (profileError) throw profileError

  const phone = (profile as { phone_number?: string | null } | null)?.phone_number ?? null
  const localJoin = getLocalSandboxJoinOverride()
  const join = connectInfo.sandboxJoinCode || localJoin
  return {
    linked: !!phone,
    linkedPhone: phone,
    botNumber: connectInfo.botNumber,
    sandboxMode: connectInfo.sandboxMode,
    sandboxJoinCode: join,
    joinConfigured: !!connectInfo.sandboxJoinCode,
    hint: connectInfo.hint,
    ...mapActiveCode(activeCode),
  }
}

/** Status / generate / unlink use Supabase directly (no nova-server required). */
export async function apiGetWhatsAppLinkStatus(forceConnectInfo = false): Promise<WhatsAppLinkStatusResult> {
  if (!isSupabaseConfigured) {
    return { linked: false, error: 'Supabase ist nicht konfiguriert.' }
  }
  try {
    const auth = await requireUserId()
    if ('error' in auth) return { linked: false, error: auth.error }
    return await buildWhatsAppStatus(auth.userId, forceConnectInfo)
  } catch (err: unknown) {
    return {
      linked: false,
      error: friendlyNetworkError(err, 'WhatsApp-Status konnte nicht geladen werden.'),
    }
  }
}

export async function apiGenerateWhatsAppLinkCode(): Promise<WhatsAppLinkStatusResult> {
  if (!isSupabaseConfigured) {
    return { linked: false, error: 'Supabase ist nicht konfiguriert.' }
  }
  try {
    const auth = await requireUserId()
    if ('error' in auth) return { linked: false, error: auth.error }
    const { userId } = auth

    // Invalidate previous unused codes for this user.
    await supabase
      .from('whatsapp_link_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('consumed_at', null)

    let lastError: string | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeLinkCode()
      const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString()
      const { error } = await supabase.from('whatsapp_link_codes').insert({
        user_id: userId,
        code,
        expires_at: expiresAt,
      })
      if (!error) return await buildWhatsAppStatus(userId)
      // Unique collision on code — retry with a new code.
      if (error.code === '23505') {
        lastError = error.message
        continue
      }
      return { linked: false, error: error.message }
    }
    return {
      linked: false,
      error: lastError || 'Code konnte nicht erzeugt werden. Bitte erneut versuchen.',
    }
  } catch (err: unknown) {
    return {
      linked: false,
      error: friendlyNetworkError(err, 'Code konnte nicht erzeugt werden.'),
    }
  }
}

export async function apiUnlinkWhatsAppNumber(): Promise<{ ok?: boolean; error?: string }> {
  if (!isSupabaseConfigured) {
    return { error: 'Supabase ist nicht konfiguriert.' }
  }
  try {
    const auth = await requireUserId()
    if ('error' in auth) return { error: auth.error }
    const { userId } = auth

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ phone_number: null })
      .eq('id', userId)
    if (profileError) return { error: profileError.message }

    await supabase
      .from('whatsapp_link_codes')
      .update({ consumed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('consumed_at', null)

    return { ok: true }
  } catch (err: unknown) {
    return { error: friendlyNetworkError(err, 'Verknüpfung konnte nicht gelöst werden.') }
  }
}

export async function apiStartWhatsAppPhoneLink(
  phone: string,
): Promise<{ ok?: boolean; phone?: string; error?: string; needsSandboxJoin?: boolean; sandboxJoinCode?: string | null }> {
  try {
    const token = await getAccessToken()
    if (!token) return { error: 'Bitte melde dich an.' }
    const res = await fetch(`${NOVA_PUBLIC.serverUrl}/api/whatsapp/link/start`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ phone }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      phone?: string
      error?: string
      needsSandboxJoin?: boolean
      sandboxJoinCode?: string | null
    }
    if (!res.ok) {
      return {
        error: data.error || `Fehler ${res.status}`,
        needsSandboxJoin: data.needsSandboxJoin,
        sandboxJoinCode: normalizeSandboxJoin(data.sandboxJoinCode),
      }
    }
    return { ok: true, phone: data.phone }
  } catch (err: unknown) {
    return { error: friendlyNetworkError(err, 'Bestätigungscode konnte nicht gesendet werden.') }
  }
}

export async function apiVerifyWhatsAppPhoneLink(
  code: string,
): Promise<{ ok?: boolean; phone?: string; error?: string }> {
  try {
    const token = await getAccessToken()
    if (!token) return { error: 'Bitte melde dich an.' }
    const res = await fetch(`${NOVA_PUBLIC.serverUrl}/api/whatsapp/link/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ code }),
    })
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; phone?: string; error?: string }
    if (!res.ok) return { error: data.error || `Fehler ${res.status}` }
    return { ok: true, phone: data.phone }
  } catch (err: unknown) {
    return { error: friendlyNetworkError(err, 'Code konnte nicht bestätigt werden.') }
  }
}

export async function apiSetSandboxJoinCode(
  joinCode: string,
): Promise<{ ok?: boolean; sandboxJoinCode?: string; error?: string }> {
  try {
    const token = await getAccessToken()
    if (!token) return { error: 'Bitte melde dich an.' }
    const res = await fetch(`${NOVA_PUBLIC.serverUrl}/api/whatsapp/sandbox-join`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ sandboxJoinCode: joinCode }),
    })
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      sandboxJoinCode?: string
      error?: string
    }
    if (!res.ok) return { error: data.error || `Fehler ${res.status}` }
    clearWhatsAppConnectInfoCache()
    return { ok: true, sandboxJoinCode: normalizeSandboxJoin(data.sandboxJoinCode) || undefined }
  } catch (err: unknown) {
    return { error: friendlyNetworkError(err, 'Join-Code konnte nicht gespeichert werden.') }
  }
}
