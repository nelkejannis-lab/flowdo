import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile } from './authStore'

export interface FriendRequest {
  id: string
  profile: Profile
}

interface FriendsState {
  friends: FriendRequest[]
  incoming: FriendRequest[]
  outgoing: FriendRequest[]
  loading: boolean
  error: string | null
  fetchAll: () => Promise<void>
  searchUsers: (query: string) => Promise<Profile[]>
  searchAllProfiles: (query: string) => Promise<Profile[]>
  sendRequest: (username: string) => Promise<string | null>
  acceptRequest: (friendshipId: string) => Promise<void>
  declineOrCancel: (friendshipId: string) => Promise<void>
  removeFriend: (friendshipId: string) => Promise<void>
}

interface FriendshipRow {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  requester: Profile
  addressee: Profile
}

export const useFriendsStore = create<FriendsState>()((set, get) => ({
  friends: [],
  incoming: [],
  outgoing: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null })
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      set({ loading: false })
      return
    }

    const { data, error } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const rows = (data ?? []) as unknown as FriendshipRow[]
    const friends: FriendRequest[] = []
    const incoming: FriendRequest[] = []
    const outgoing: FriendRequest[] = []

    for (const row of rows) {
      const isRequester = row.requester_id === userId
      const other = isRequester ? row.addressee : row.requester
      if (row.status === 'accepted') {
        friends.push({ id: row.id, profile: other })
      } else if (row.status === 'pending') {
        if (isRequester) outgoing.push({ id: row.id, profile: other })
        else incoming.push({ id: row.id, profile: other })
      }
    }

    set({ friends, incoming, outgoing, loading: false })
  },

  searchUsers: async (query) => {
    const cleanQuery = query.trim().toLowerCase().replace(/^@/, '')
    if (!cleanQuery) return []

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
      .neq('id', userId ?? '')
      .limit(5)

    if (error || !data) return []

    const { friends, incoming, outgoing } = get()
    const excludedIds = new Set([
      ...friends.map((f) => f.profile.id),
      ...incoming.map((f) => f.profile.id),
      ...outgoing.map((f) => f.profile.id),
    ])

    return (data as Profile[]).filter((p) => !excludedIds.has(p.id))
  },

  searchAllProfiles: async (query) => {
    const cleanQuery = query.trim().toLowerCase().replace(/^@/, '')
    if (!cleanQuery || cleanQuery.length < 2) return []
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%`)
      .neq('id', userId ?? '')
      .limit(8)
    if (error || !data) return []
    return data as Profile[]
  },

  sendRequest: async (username) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return 'Nicht angemeldet'

    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '')
    if (!cleanUsername) return 'Bitte einen Benutzernamen eingeben'

    const { data: target, error: lookupError } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', cleanUsername)
      .maybeSingle()

    if (lookupError) return lookupError.message
    if (!target) return `Kein Nutzer mit dem Namen "${cleanUsername}" gefunden`
    if (target.id === userId) return 'Du kannst dich nicht selbst hinzufügen'

    const { error } = await supabase.from('friendships').insert({
      requester_id: userId,
      addressee_id: target.id,
      status: 'pending',
    })

    if (error) {
      if (error.code === '23505') return 'Anfrage existiert bereits'
      return error.message
    }

    await get().fetchAll()
    return null
  },

  acceptRequest: async (friendshipId) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    await get().fetchAll()
  },

  declineOrCancel: async (friendshipId) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    await get().fetchAll()
  },

  removeFriend: async (friendshipId) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    await get().fetchAll()
  },
}))
