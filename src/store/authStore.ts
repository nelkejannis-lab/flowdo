import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_color: string
  avatar_url?: string | null
  birthday?: string | null
  is_admin?: boolean
  job_title?: string | null
  work_location?: string | null
  badge?: string | null
  created_at: string
}

interface ProfileUpdate {
  username?: string
  display_name?: string
  avatar_color?: string
  avatar_url?: string | null
  birthday?: string | null
  job_title?: string | null
  work_location?: string | null
  badge?: string | null
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  init: () => () => void
  fetchProfile: () => Promise<void>
  signUp: (email: string, password: string, username: string, displayName: string, birthday?: string) => Promise<string | null>
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  updateProfile: (updates: ProfileUpdate) => Promise<string | null>
  updatePassword: (newPassword: string) => Promise<string | null>
  requestPasswordReset: (email: string) => Promise<string | null>
  exportUserData: () => Promise<string | null>
  deleteAccount: () => Promise<string | null>
  setBadgeForUser: (userId: string, badge: string | null) => Promise<string | null>
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

  signUp: async (email, password, username, displayName, birthday) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username, display_name: displayName } },
    })
    if (error) return error.message
    // Save birthday to profile after signup
    if (birthday && data.user) {
      await supabase.from('profiles').update({ birthday }).eq('id', data.user.id)
    }
    return null
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

  exportUserData: async () => {
    const userId = get().user?.id
    const user = get().user
    if (!userId || !user) return 'Nicht angemeldet'

    const tables = ['profiles', 'tasks', 'boards', 'board_columns', 'comments', 'work_time_entries', 'calendar_entries', 'friendships']
    const data: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email, created_at: user.created_at },
    }

    for (const table of tables) {
      const { data: rows } = await supabase.from(table).select('*')
      data[table] = rows ?? []
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mooncrew-daten-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    return null
  },

  setBadgeForUser: async (userId, badge) => {
    const { error } = await supabase.from('profiles').update({ badge }).eq('id', userId)
    return error?.message ?? null
  },

  deleteAccount: async () => {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) return error.message
    set({ session: null, user: null, profile: null })
    return null
  },
}))
