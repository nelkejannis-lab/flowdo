import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile } from './authStore'
import { useTeamsStore } from './teamsStore'

export interface IncomingTeamInvite {
  id: string
  teamId: string
  teamName: string
  fromUser: Profile
}

interface TeamInviteRow {
  id: string
  team_id: string
  team: { name: string } | { name: string }[]
  from_user: Profile | Profile[]
}

function single<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v
}

interface TeamInvitesState {
  incoming: IncomingTeamInvite[]
  loading: boolean
  fetchIncoming: () => Promise<void>
  sendInvite: (teamId: string, teamName: string, toUserId: string) => Promise<string | null>
  acceptInvite: (inviteId: string) => Promise<void>
  declineInvite: (inviteId: string) => Promise<void>
}

export const useTeamInvitesStore = create<TeamInvitesState>()((set) => ({
  incoming: [],
  loading: false,

  fetchIncoming: async () => {
    set({ loading: true })
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) { set({ loading: false }); return }

    const { data, error } = await supabase
      .from('team_invites')
      .select('id, team_id, team:teams(name), from_user:profiles!team_invites_from_user_id_fkey(*)')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!error && data) {
      const incoming = (data as unknown as TeamInviteRow[])
        .map((row) => ({
          id: row.id,
          teamId: row.team_id,
          teamName: single(row.team).name,
          fromUser: single(row.from_user),
        }))
        .filter((r) => r.teamName && r.fromUser)
      set({ incoming, loading: false })
    } else {
      set({ loading: false })
    }
  },

  sendInvite: async (teamId, teamName, toUserId) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return 'Nicht angemeldet'

    const { error } = await supabase.from('team_invites').insert({
      team_id: teamId,
      from_user_id: userId,
      to_user_id: toUserId,
      status: 'pending',
    })

    if (error) {
      if (error.code === '23505') return 'Einladung bereits gesendet'
      return error.message
    }
    return null
  },

  acceptInvite: async (inviteId) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return

    const invite = useTeamInvitesStore.getState().incoming.find((i) => i.id === inviteId)
    if (!invite) return

    // Add to team_members
    await supabase.from('team_members').insert({ team_id: invite.teamId, user_id: userId })
    // Mark invite as accepted
    await supabase.from('team_invites').update({ status: 'accepted' }).eq('id', inviteId)
    // Remove from local list
    set((s) => ({ incoming: s.incoming.filter((i) => i.id !== inviteId) }))
    // Refresh teams
    await useTeamsStore.getState().fetch()
  },

  declineInvite: async (inviteId) => {
    await supabase.from('team_invites').update({ status: 'declined' }).eq('id', inviteId)
    set((s) => ({ incoming: s.incoming.filter((i) => i.id !== inviteId) }))
  },
}))
