import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { createId } from '../utils/id'
import { useAuthStore } from './authStore'

export interface OrgInviteLink {
  id: string
  orgId: string
  token: string
  role: string
  expiresAt?: string
  createdAt: string
}

interface OrgJoinState {
  links: OrgInviteLink[]
  fetchLinks: (orgId: string) => Promise<void>
  createLink: (orgId: string, role?: string) => Promise<{ url: string; token: string } | null>
  joinWithToken: (token: string) => Promise<string | null>
  revokeLink: (id: string) => Promise<void>
}

function joinUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/join/${encodeURIComponent(token)}`
}

export const useOrgJoinStore = create<OrgJoinState>()((set, get) => ({
  links: [],

  fetchLinks: async (orgId) => {
    if (!isSupabaseConfigured) return
    const { data } = await supabase
      .from('org_invite_links')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
    if (data) {
      set({
        links: data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          orgId: r.org_id as string,
          token: r.token as string,
          role: (r.role as string) ?? 'member',
          expiresAt: (r.expires_at as string) ?? undefined,
          createdAt: r.created_at as string,
        })),
      })
    }
  },

  createLink: async (orgId, role = 'member') => {
    const token = createId().replace(/-/g, '').slice(0, 24)
    const link: OrgInviteLink = {
      id: createId(),
      orgId,
      token,
      role,
      createdAt: new Date().toISOString(),
    }
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('org_invite_links').insert({
        id: link.id,
        org_id: orgId,
        token,
        role,
      })
      if (error) {
        // Fallback: store locally in session for demo
        set((s) => ({ links: [link, ...s.links] }))
        return { url: joinUrl(token), token }
      }
    }
    set((s) => ({ links: [link, ...s.links] }))
    return { url: joinUrl(token), token }
  },

  joinWithToken: async (token) => {
    const userId = useAuthStore.getState().user?.id
    if (!userId) return 'Not signed in'
    if (!isSupabaseConfigured) return 'Supabase required'

    const { data: linkRow } = await supabase
      .from('org_invite_links')
      .select('org_id, role, expires_at')
      .eq('token', token)
      .maybeSingle()

    if (!linkRow) {
      const local = get().links.find((l) => l.token === token)
      if (!local) return 'Invalid or expired invite link'
      const { error } = await supabase.from('organization_members').upsert({
        org_id: local.orgId,
        user_id: userId,
        role: local.role,
      })
      if (error) return error.message
      await supabase.from('profiles').update({ org_id: local.orgId }).eq('id', userId)
      return null
    }

    if (linkRow.expires_at && new Date(linkRow.expires_at) < new Date()) {
      return 'Invite link expired'
    }

    const { error } = await supabase.from('organization_members').upsert({
      org_id: linkRow.org_id,
      user_id: userId,
      role: linkRow.role ?? 'member',
    })
    if (error) return error.message
    await supabase.from('profiles').update({ org_id: linkRow.org_id }).eq('id', userId)
    return null
  },

  revokeLink: async (id) => {
    set((s) => ({ links: s.links.filter((l) => l.id !== id) }))
    if (isSupabaseConfigured) {
      await supabase.from('org_invite_links').delete().eq('id', id)
    }
  },
}))
