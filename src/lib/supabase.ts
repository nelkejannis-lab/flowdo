import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLIC } from '../config/supabasePublic'

function resolveSupabaseConfig() {
  const runtime =
    typeof window !== 'undefined'
      ? window.novat?.config ?? window.mooncrew?.config
      : undefined
  const url =
    runtime?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || SUPABASE_PUBLIC.url
  const anonKey =
    runtime?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_PUBLIC.anonKey
  return { url, anonKey }
}

const { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveSupabaseConfig()

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    !supabaseUrl.includes('placeholder')
)

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)
