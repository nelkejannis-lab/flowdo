import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Organization, OrganizationMember, OrgRole } from '../types'
import { useAuthStore } from './authStore'

interface OrgState {
  organization: Organization | null
  members: OrganizationMember[]
  myRole: OrgRole | null
  loading: boolean
  fetch: () => Promise<void>
  create: (name: string) => Promise<string | null>
  inviteMember: (userId: string, role?: OrgRole) => Promise<string | null>
  updateMemberRole: (userId: string, role: OrgRole) => Promise<string | null>
  removeMember: (userId: string) => Promise<string | null>
  searchProfiles: (query: string) => Promise<{ id: string; display_name: string; username: string }[]>
  canManage: () => boolean
  canApproveAbsences: () => boolean
}

function single<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v
}

export const useOrganizationStore = create<OrgState>()((set, get) => ({
  organization: null,
  members: [],
  myRole: null,
  loading: false,

  fetch: async () => {
    const userId = useAuthStore.getState().user?.id
    if (!userId) return
    set({ loading: true })

    const { data: membership } = await supabase
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', userId)
      .maybeSingle()

    if (!membership) {
      set({ organization: null, members: [], myRole: null, loading: false })
      return
    }

    const orgId = membership.org_id
    const [{ data: org }, { data: members }] = await Promise.all([
      supabase.from('organizations').select('*').eq('id', orgId).single(),
      supabase
        .from('organization_members')
        .select('user_id, role, profile:profiles!organization_members_user_id_fkey(id, display_name, username, avatar_color, job_title)')
        .eq('org_id', orgId)
        .order('joined_at', { ascending: true }),
    ])

    if (!org) {
      set({ organization: null, members: [], myRole: null, loading: false })
      return
    }

    const parsedMembers: OrganizationMember[] = (members ?? []).map((m: any) => ({
      userId: m.user_id,
      role: m.role as OrgRole,
      profile: single(m.profile),
    }))

    set({
      organization: {
        id: org.id,
        name: org.name,
        ownerId: org.owner_id,
        createdAt: org.created_at,
      },
      members: parsedMembers,
      myRole: membership.role as OrgRole,
      loading: false,
    })
  },

  create: async (name) => {
    const userId = useAuthStore.getState().user?.id
    if (!userId) return 'Not signed in'
    const trimmed = name.trim()
    if (!trimmed) return 'Name required'

    const { data: org, error } = await supabase
      .from('organizations')
      .insert({ name: trimmed, owner_id: userId })
      .select()
      .single()

    if (error || !org) return error?.message ?? 'Failed to create organization'

    await supabase.from('organization_members').insert({
      org_id: org.id,
      user_id: userId,
      role: 'owner',
    })
    await supabase.from('profiles').update({ org_id: org.id }).eq('id', userId)

    await get().fetch()
    return null
  },

  inviteMember: async (userId, role = 'member') => {
    const org = get().organization
    if (!org) return 'No organization'
    if (!get().canManage()) return 'Not allowed'

    const { error } = await supabase.from('organization_members').upsert({
      org_id: org.id,
      user_id: userId,
      role,
    })
    if (error) return error.message
    await supabase.from('profiles').update({ org_id: org.id }).eq('id', userId)
    await get().fetch()
    return null
  },

  updateMemberRole: async (userId, role) => {
    const org = get().organization
    if (!org || !get().canManage()) return 'Not allowed'
    const { error } = await supabase
      .from('organization_members')
      .update({ role })
      .eq('org_id', org.id)
      .eq('user_id', userId)
    if (error) return error.message
    await get().fetch()
    return null
  },

  removeMember: async (userId) => {
    const org = get().organization
    if (!org || !get().canManage()) return 'Not allowed'
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('org_id', org.id)
      .eq('user_id', userId)
    if (error) return error.message
    await supabase.from('profiles').update({ org_id: null }).eq('id', userId)
    await get().fetch()
    return null
  },

  searchProfiles: async (query) => {
    const q = query.trim()
    if (q.length < 2) return []
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(8)
    return data ?? []
  },

  canManage: () => {
    const profile = useAuthStore.getState().profile
    if (profile?.is_admin) return true
    const role = get().myRole
    return role === 'owner' || role === 'admin'
  },

  canApproveAbsences: () => {
    const profile = useAuthStore.getState().profile
    if (profile?.is_admin) return true
    const role = get().myRole
    return role === 'owner' || role === 'admin' || role === 'manager'
  },
}))
