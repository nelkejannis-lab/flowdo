import { useAuthStore } from '../store/authStore'
import { NOVA_PUBLIC } from '../config/novaPublic'

function resolveNovaServerUrl(): string | undefined {
  const env = import.meta.env.VITE_NOVA_SERVER_URL as string | undefined
  if (env?.trim()) return env.trim()
  return NOVA_PUBLIC.serverUrl
}

const NOVA_SERVER_URL = resolveNovaServerUrl()

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export function novaApiAvailable() {
  return !!NOVA_SERVER_URL
}

async function postJson<T>(path: string, body: unknown): Promise<T & { error?: string }> {
  return requestJson<T>(path, 'POST', body)
}

async function requestJson<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T & { error?: string }> {
  if (!NOVA_SERVER_URL) return { error: 'NOVAT-Server ist nicht konfiguriert.' } as T & { error?: string }
  try {
    const res = await fetch(`${NOVA_SERVER_URL}${path}`, {
      method,
      headers: authHeaders(),
      ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { error: json.error || `Fehler (${res.status})` } as T & { error?: string }
    return json
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message } as T & { error?: string }
  }
}

export interface WhatsAppLinkStatusResult {
  linked: boolean
  linkedPhone?: string | null
  linkCode?: string | null
  linkCodeExpiresAt?: string | null
  remainingAttempts?: number | null
  sandboxMode?: boolean
  sandboxJoinCode?: string | null
  botNumber?: string | null
  error?: string
}

export async function apiGetWhatsAppLinkStatus(): Promise<WhatsAppLinkStatusResult> {
  return requestJson('/api/whatsapp/link-code/status', 'GET')
}

export async function apiGenerateWhatsAppLinkCode(): Promise<WhatsAppLinkStatusResult> {
  return postJson('/api/whatsapp/link-code/generate', {})
}

export async function apiUnlinkWhatsAppNumber(): Promise<{ ok?: boolean; error?: string }> {
  return postJson('/api/whatsapp/unlink', {})
}
