import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_color: string
  avatar_url?: string | null
  created_at: string
}

interface ProfileUpdate {
  username?: string
  display_name?: string
  avatar_color?: string
  avatar_url?: string | null
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  init: () => () => void
  fetchProfile: () => Promise<void>
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  updateProfile: (updates: ProfileUpdate) => Promise<string | null>
  updatePassword: (newPassword: string) => Promise<string | null>
  requestPasswordReset: (email: string) => Promise<string | null>
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,

  init: () => {
    supabase.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, loading: false })
      if (data.session?.user) get().fetchProfile()
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, loading: false })
      if (session?.user) {
        get().fetchProfile()
      } else {
        set({ profile: null })
      }
    })

    return () => listener.subscription.unsubscribe()
  },

  fetchProfile: async () => {
    const userId = get().user?.id
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) set({ profile: data as Profile })
  },

  signUp: async (email, password, username, displayName) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: displayName } },
    })
    return error?.message ?? null
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
  },

  updateProfile: async (updates) => {
    const userId = get().user?.id
    if (!userId) return 'Nicht angemeldet'

    if (updates.username !== undefined) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', updates.username)
        .neq('id', userId)
        .maybeSingle()
      if (existing) return 'Benutzername ist bereits vergeben'
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', userId)
    if (error) return error.message

    await get().fetchProfile()
    return null
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return error?.message ?? null
  },

  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    return error?.message ?? null
  },
}))
