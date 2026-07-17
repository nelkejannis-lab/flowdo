import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { friendlyUserError } from '../lib/friendlyErrors'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_color: string
  avatar_url?: string | null
  birthday?: string | null
  phone_number?: string | null
  is_admin?: boolean
  app_role?: 'user' | 'admin'
  role_description?: string | null
  job_title?: string | null
  work_location?: string | null
  badge?: string | null
  org_id?: string | null
  settings?: Record<string, any> | null
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
  role_description?: string | null
  badge?: string | null
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  init: () => () => void
  fetchProfile: () => Promise<void>
  subscribeToProfile: () => () => void
  signUp: (email: string, password: string, username: string, displayName: string, birthday?: string, roleDescription?: string) => Promise<string | null>
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
    let settled = false
    const finish = (session: Session | null) => {
      if (settled) return
      settled = true
      set({
        session,
        user: session?.user ?? null,
        loading: false,
      })
      if (session?.user) get().fetchProfile()
    }

    const timeout =
      typeof window !== 'undefined'
        ? window.setTimeout(() => {
            console.warn('[NOVAT] Auth session check timed out — showing login')
            finish(null)
          }, 8000)
        : undefined

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.error('[NOVAT] getSession failed:', error.message)
        finish(data.session)
      })
      .catch((err) => {
        console.error('[NOVAT] getSession error:', err)
        finish(null)
      })
      .finally(() => {
        if (timeout !== undefined) window.clearTimeout(timeout)
      })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      settled = true
      set({ session, user: session?.user ?? null, loading: false })
      if (session?.user) {
        get().fetchProfile()
      } else {
        set({ profile: null })
      }
    })

    let unsubscribeProfile = get().subscribeToProfile()

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout)
      listener.subscription.unsubscribe()
      unsubscribeProfile()
    }
  },

  fetchProfile: async () => {
    const userId = get().user?.id
    if (!userId) return
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      set({ profile: data as Profile })
      // Dynamically load settings store to avoid circular dependency
      const settingsStore = (await import('./settingsStore')).useSettingsStore
      if (data.settings && Object.keys(data.settings).length > 0) {
        settingsStore.getState().importSettings(data.settings)
      } else {
        // Sync local settings to DB if empty
        settingsStore.getState().syncNow()
      }
    }
  },

  subscribeToProfile: () => {
    const userId = get().user?.id
    if (!userId) return () => {}

    const channel = supabase
      .channel('profile-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        () => {
          // Re-fetch profile to sync settings and other profile data
          get().fetchProfile()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  signUp: async (email, password, username, displayName, birthday, roleDescription) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName,
          role_description: roleDescription?.trim() || null,
        },
      },
    })
    if (error) return friendlyUserError(error.message)
    if (data.user) {
      const updates: ProfileUpdate = {}
      if (birthday) updates.birthday = birthday
      if (roleDescription?.trim()) updates.role_description = roleDescription.trim()
      if (Object.keys(updates).length > 0) {
        await supabase.from('profiles').update(updates).eq('id', data.user.id)
      }
    }
    return null
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error ? friendlyUserError(error.message) : null
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
    const settingsStore = (await import('./settingsStore')).useSettingsStore
    settingsStore.getState().resetSettings()
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
    if (error) return friendlyUserError(error.message)

    await get().fetchProfile()
    return null
  },

  updatePassword: async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return error ? friendlyUserError(error.message) : null
  },

  requestPasswordReset: async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })
    return error ? friendlyUserError(error.message) : null
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
    a.download = `novat-daten-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    return null
  },

  setBadgeForUser: async (userId, badge) => {
    const { error } = await supabase.rpc('admin_set_badge', { p_user_id: userId, p_badge: badge })
    return error ? friendlyUserError(error.message) : null
  },

  deleteAccount: async () => {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) return friendlyUserError(error.message)
    set({ session: null, user: null, profile: null })
    return null
  },
}))
