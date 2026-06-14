import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile } from './authStore'

export interface Team {
  id: string
  name: string
  members: Profile[]
}

interface TeamsState {
  teams: Team[]
  loading: boolean
  fetch: () => Promise<void>
  create: (name: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
  addMember: (teamId: string, userId: string) => Promise<void>
  removeMember: (teamId: string, userId: string) => Promise<void>
}

interface TeamRow {
  id: string
  name: string
  team_members: { user_id: string; profile: Profile | Profile[] }[]
}

function single<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v
}

export const useTeamsStore = create<TeamsState>()((set, get) => ({
  teams: [],
  loading: false,

  fetch: async () => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('teams')
      .select('id, name, team_members(user_id, profile:profiles!team_members_user_id_fkey(*))')
      .order('created_at', { ascending: true })

    if (!error && data) {
      const teams = (data as unknown as TeamRow[]).map((t) => ({
        id: t.id,
        name: t.name,
        members: t.team_members.map((m) => single(m.profile)).filter(Boolean),
      }))
      set({ teams, loading: false })
    } else {
      set({ loading: false })
    }
  },

  create: async (name) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return
    const { data, error } = await supabase
      .from('teams')
      .insert({ owner_id: userId, name })
      .select('id, name')
      .single()
    if (!error && data) {
      set((s) => ({ teams: [...s.teams, { id: data.id, name: data.name, members: [] }] }))
    }
  },

  rename: async (id, name) => {
    await supabase.from('teams').update({ name }).eq('id', id)
    set((s) => ({ teams: s.teams.map((t) => t.id === id ? { ...t, name } : t) }))
  },

  remove: async (id) => {
    await supabase.from('teams').delete().eq('id', id)
    set((s) => ({ teams: s.teams.filter((t) => t.id !== id) }))
  },

  addMember: async (teamId, userId) => {
    // Now handled via invites — direct add only for owner themselves
    await supabase.from('team_members').insert({ team_id: teamId, user_id: userId })
    await get().fetch()
  },

  removeMember: async (teamId, userId) => {
    await supabase.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId)
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId ? { ...t, members: t.members.filter((m) => m.id !== userId) } : t
      ),
    }))
  },
}))
