import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { createId } from '../utils/id'

export type CreativeInviteRole = 'owner' | 'editor' | 'viewer'
export type MoodboardItemType = 'note' | 'image' | 'link'

export interface MoodboardItem {
  id: string
  ownerId: string
  title: string
  type: MoodboardItemType
  textContent?: string
  imageUrl?: string
  linkUrl?: string
  position: number
  createdAt: string
  updatedAt: string
}

export interface CreativeBoardInvite {
  id: string
  fromUserId: string
  toUserId: string
  role: CreativeInviteRole
  status: 'pending' | 'accepted' | 'declined'
  createdAt: string
  fromUser?: { id: string; display_name: string; username: string; avatar_color: string }
}

export interface CreativeBoardMember {
  ownerId: string
  userId: string
  role: CreativeInviteRole
  createdAt: string
  profile?: { id: string; display_name: string; username: string; avatar_color: string }
}

interface CreativeBoardState {
  moodItems: MoodboardItem[]
  incomingInvites: CreativeBoardInvite[]
  members: CreativeBoardMember[]
  fetchMoodItems: () => Promise<void>
  addMoodItem: (input: Omit<MoodboardItem, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateMoodItem: (id: string, updates: Partial<MoodboardItem>) => Promise<void>
  deleteMoodItem: (id: string) => Promise<void>
  searchProfiles: (query: string) => Promise<Array<{ id: string; display_name: string; username: string; avatar_color: string }>>
  inviteToCreativeBoard: (toUserId: string, role: CreativeInviteRole) => Promise<string | null>
  fetchIncomingInvites: () => Promise<void>
  acceptInvite: (inviteId: string) => Promise<string | null>
  declineInvite: (inviteId: string) => Promise<void>
  fetchMembers: () => Promise<void>
}

async function getUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export const useCreativeBoardStore = create<CreativeBoardState>()((set, get) => ({
  moodItems: [],
  incomingInvites: [],
  members: [],

  fetchMoodItems: async () => {
    const userId = await getUserId()
    if (!userId) return
    const { data } = await supabase
      .from('creative_moodboard_items')
      .select('*')
      .order('position', { ascending: true })
    const rows = (data ?? []) as any[]
    set({
      moodItems: rows.map((r) => ({
        id: r.id,
        ownerId: r.owner_id,
        title: r.title,
        type: r.type,
        textContent: r.text_content ?? undefined,
        imageUrl: r.image_url ?? undefined,
        linkUrl: r.link_url ?? undefined,
        position: r.position ?? 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    })
  },

  addMoodItem: async (input) => {
    const userId = await getUserId()
    if (!userId) return
    const item: MoodboardItem = {
      id: createId(),
      ownerId: userId,
      title: input.title,
      type: input.type,
      textContent: input.textContent,
      imageUrl: input.imageUrl,
      linkUrl: input.linkUrl,
      position: input.position,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set((s) => ({ moodItems: [...s.moodItems, item] }))
    await supabase.from('creative_moodboard_items').insert({
      id: item.id,
      owner_id: item.ownerId,
      title: item.title,
      type: item.type,
      text_content: item.textContent ?? null,
      image_url: item.imageUrl ?? null,
      link_url: item.linkUrl ?? null,
      position: item.position,
    })
  },

  updateMoodItem: async (id, updates) => {
    const existing = get().moodItems.find((i) => i.id === id)
    if (!existing) return
    const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() }
    set((s) => ({ moodItems: s.moodItems.map((i) => (i.id === id ? updated : i)) }))
    await supabase
      .from('creative_moodboard_items')
      .update({
        title: updated.title,
        type: updated.type,
        text_content: updated.textContent ?? null,
        image_url: updated.imageUrl ?? null,
        link_url: updated.linkUrl ?? null,
        position: updated.position,
      })
      .eq('id', id)
  },

  deleteMoodItem: async (id) => {
    set((s) => ({ moodItems: s.moodItems.filter((i) => i.id !== id) }))
    await supabase.from('creative_moodboard_items').delete().eq('id', id)
  },

  searchProfiles: async (query) => {
    const clean = query.trim().replace(/^@/, '')
    if (clean.length < 2) return []
    const me = await getUserId()
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_color')
      .or(`username.ilike.%${clean}%,display_name.ilike.%${clean}%`)
      .neq('id', me ?? '')
      .limit(8)
    return (data ?? []) as Array<{ id: string; display_name: string; username: string; avatar_color: string }>
  },

  inviteToCreativeBoard: async (toUserId, role) => {
    const fromUserId = await getUserId()
    if (!fromUserId) return 'Nicht angemeldet'
    const { data: existing } = await supabase
      .from('creative_board_invites')
      .select('id')
      .eq('from_user_id', fromUserId)
      .eq('to_user_id', toUserId)
      .eq('status', 'pending')
      .maybeSingle()
    if (existing) return 'Einladung bereits ausstehend'
    const { error } = await supabase.from('creative_board_invites').insert({
      from_user_id: fromUserId,
      to_user_id: toUserId,
      role,
      status: 'pending',
    })
    return error ? error.message : null
  },

  fetchIncomingInvites: async () => {
    const userId = await getUserId()
    if (!userId) return
    const { data } = await supabase
      .from('creative_board_invites')
      .select('id, from_user_id, to_user_id, role, status, created_at, from_user:profiles!creative_board_invites_from_user_id_fkey(id, display_name, username, avatar_color)')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as any[]
    set({
      incomingInvites: rows.map((r) => ({
        id: r.id,
        fromUserId: r.from_user_id,
        toUserId: r.to_user_id,
        role: r.role,
        status: r.status,
        createdAt: r.created_at,
        fromUser: Array.isArray(r.from_user) ? r.from_user[0] : r.from_user,
      })),
    })
  },

  acceptInvite: async (inviteId) => {
    const invite = get().incomingInvites.find((i) => i.id === inviteId)
    if (!invite) return null
    const { error } = await supabase.from('creative_board_members').upsert({
      owner_id: invite.fromUserId,
      user_id: invite.toUserId,
      role: invite.role,
    })
    if (error) return error.message
    await supabase.from('creative_board_invites').update({ status: 'accepted' }).eq('id', inviteId)
    set((s) => ({ incomingInvites: s.incomingInvites.filter((i) => i.id !== inviteId) }))
    return null
  },

  declineInvite: async (inviteId) => {
    await supabase.from('creative_board_invites').update({ status: 'declined' }).eq('id', inviteId)
    set((s) => ({ incomingInvites: s.incomingInvites.filter((i) => i.id !== inviteId) }))
  },

  fetchMembers: async () => {
    const ownerId = await getUserId()
    if (!ownerId) return
    const { data } = await supabase
      .from('creative_board_members')
      .select('owner_id, user_id, role, created_at, profile:profiles!creative_board_members_user_id_fkey(id, display_name, username, avatar_color)')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as any[]
    set({
      members: rows.map((r) => ({
        ownerId: r.owner_id,
        userId: r.user_id,
        role: r.role,
        createdAt: r.created_at,
        profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
      })),
    })
  },
}))
