import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLIC } from '../config/supabasePublic'

function isUsableSupabaseUrl(url: string | undefined): url is string {
  if (!url) return false
  if (url === '[SENSITIVE]' || url.includes('placeholder')) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function isUsableAnonKey(key: string | undefined): key is string {
  return Boolean(key && key !== '[SENSITIVE]' && key !== 'placeholder-anon-key' && key.length > 20)
}

function resolveSupabaseConfig() {
  const runtime =
    typeof window !== 'undefined'
      ? window.novat?.config ?? window.mooncrew?.config
      : undefined
  const urlCandidate =
    runtime?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || SUPABASE_PUBLIC.url
  const keyCandidate =
    runtime?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_PUBLIC.anonKey
  return {
    url: isUsableSupabaseUrl(urlCandidate) ? urlCandidate : SUPABASE_PUBLIC.url,
    anonKey: isUsableAnonKey(keyCandidate) ? keyCandidate : SUPABASE_PUBLIC.anonKey,
  }
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig()

export const isSupabaseConfigured = Boolean(
  isUsableSupabaseUrl(supabaseUrl) && isUsableAnonKey(supabaseAnonKey)
)

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
