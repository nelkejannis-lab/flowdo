import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile } from './authStore'

export interface TeamMessage {
  id: string
  teamId: string
  fromUserId: string
  fromUser?: Profile
  body: string
  createdAt: string
}

export interface Message {
  id: string
  fromUserId: string
  toUserId: string
  body: string
  read: boolean
  createdAt: string
}

export interface Conversation {
  profile: Profile
  lastMessage: Message
  unreadCount: number
}

interface MessagesState {
  conversations: Conversation[]
  messages: Record<string, Message[]> // keyed by other user's ID
  teamMessages: Record<string, TeamMessage[]> // keyed by team ID
  unreadTotal: number
  loading: boolean
  fetchConversations: () => Promise<void>
  fetchMessages: (withUserId: string) => Promise<void>
  sendMessage: (toUserId: string, body: string) => Promise<void>
  markRead: (withUserId: string) => Promise<void>
  fetchTeamMessages: (teamId: string) => Promise<void>
  sendTeamMessage: (teamId: string, body: string) => Promise<void>
  subscribeToMessages: (currentUserId: string, onNew: () => void) => () => void
  subscribeToTeamMessages: (teamId: string, onNew: () => void) => () => void
}

interface MessageRow {
  id: string
  from_user_id: string
  to_user_id: string
  body: string
  read: boolean
  created_at: string
  from_user?: Profile | Profile[]
  to_user?: Profile | Profile[]
}

function single<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    body: row.body,
    read: row.read,
    createdAt: row.created_at,
  }
}

export const useMessagesStore = create<MessagesState>()((set, get) => ({
  conversations: [],
  messages: {},
  teamMessages: {},
  unreadTotal: 0,
  loading: false,

  fetchConversations: async () => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from('messages')
      .select('*, from_user:profiles!messages_from_user_id_fkey(*), to_user:profiles!messages_to_user_id_fkey(*)')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error || !data) return

    const rows = data as unknown as MessageRow[]

    // Group by conversation partner
    const convMap = new Map<string, { profile: Profile; messages: Message[] }>()
    for (const row of rows) {
      const isFromMe = row.from_user_id === userId
      const partnerId = isFromMe ? row.to_user_id : row.from_user_id
      const partnerProfile = isFromMe ? single(row.to_user!) : single(row.from_user!)
      if (!convMap.has(partnerId)) {
        convMap.set(partnerId, { profile: partnerProfile, messages: [] })
      }
      convMap.get(partnerId)!.messages.push(toMessage(row))
    }

    const conversations: Conversation[] = []
    let unreadTotal = 0
    for (const [, conv] of convMap) {
      const unread = conv.messages.filter((m) => m.toUserId === userId && !m.read).length
      unreadTotal += unread
      conversations.push({
        profile: conv.profile,
        lastMessage: conv.messages[0],
        unreadCount: unread,
      })
    }

    set({ conversations, unreadTotal })
  },

  fetchMessages: async (withUserId) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return

    set({ loading: true })
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(from_user_id.eq.${userId},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${userId})`
      )
      .order('created_at', { ascending: true })

    if (!error && data) {
      set((s) => ({
        messages: { ...s.messages, [withUserId]: (data as unknown as MessageRow[]).map(toMessage) },
        loading: false,
      }))
    } else {
      set({ loading: false })
    }
  },

  sendMessage: async (toUserId, body) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId || !body.trim()) return

    const { data } = await supabase
      .from('messages')
      .insert({ from_user_id: userId, to_user_id: toUserId, body: body.trim() })
      .select()
      .single()

    if (data) {
      const msg = toMessage(data as unknown as MessageRow)
      set((s) => ({
        messages: {
          ...s.messages,
          [toUserId]: [...(s.messages[toUserId] ?? []), msg],
        },
      }))
    }
    get().fetchConversations()
  },

  markRead: async (withUserId) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return

    await supabase
      .from('messages')
      .update({ read: true })
      .eq('to_user_id', userId)
      .eq('from_user_id', withUserId)
      .eq('read', false)

    set((s) => ({
      messages: {
        ...s.messages,
        [withUserId]: (s.messages[withUserId] ?? []).map((m) =>
          m.toUserId === userId ? { ...m, read: true } : m
        ),
      },
      conversations: s.conversations.map((c) =>
        c.profile.id === withUserId ? { ...c, unreadCount: 0 } : c
      ),
      unreadTotal: Math.max(0, s.unreadTotal - (s.conversations.find((c) => c.profile.id === withUserId)?.unreadCount ?? 0)),
    }))
  },

  fetchTeamMessages: async (teamId) => {
    const { data, error } = await supabase
      .from('team_messages')
      .select('*, from_user:profiles!team_messages_from_user_id_fkey(*)')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      const msgs: TeamMessage[] = (data as unknown as Array<{
        id: string; team_id: string; from_user_id: string; body: string; created_at: string
        from_user: Profile | Profile[]
      }>).map((row) => ({
        id: row.id,
        teamId: row.team_id,
        fromUserId: row.from_user_id,
        fromUser: single(row.from_user),
        body: row.body,
        createdAt: row.created_at,
      }))
      set((s) => ({ teamMessages: { ...s.teamMessages, [teamId]: msgs } }))
    }
  },

  sendTeamMessage: async (teamId, body) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId || !body.trim()) return

    const { data } = await supabase
      .from('team_messages')
      .insert({ team_id: teamId, from_user_id: userId, body: body.trim() })
      .select('*, from_user:profiles!team_messages_from_user_id_fkey(*)')
      .single()

    if (data) {
      const row = data as unknown as { id: string; team_id: string; from_user_id: string; body: string; created_at: string; from_user: Profile | Profile[] }
      const msg: TeamMessage = {
        id: row.id, teamId: row.team_id, fromUserId: row.from_user_id,
        fromUser: single(row.from_user), body: row.body, createdAt: row.created_at,
      }
      set((s) => ({ teamMessages: { ...s.teamMessages, [teamId]: [...(s.teamMessages[teamId] ?? []), msg] } }))
    }
  },

  subscribeToMessages: (currentUserId, onNew) => {
    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user_id=eq.${currentUserId}` },
        () => {
          get().fetchConversations()
          onNew()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  },

  subscribeToTeamMessages: (teamId, onNew) => {
    const channel = supabase
      .channel(`team-messages-${teamId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `team_id=eq.${teamId}` },
        () => {
          get().fetchTeamMessages(teamId)
          onNew()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  },
}))
