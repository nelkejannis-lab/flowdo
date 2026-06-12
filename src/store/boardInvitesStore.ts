import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Profile } from './authStore'
import { useBoardsStore } from './boardsStore'

export interface IncomingBoardInvite {
  id: string
  boardId: string
  boardTitle: string
  boardColor: string
  fromUser: Profile
}

interface BoardInviteRow {
  id: string
  board_id: string
  board_title: string
  board_color: string
  from_user: Profile | Profile[]
}

interface BoardInvitesState {
  incoming: IncomingBoardInvite[]
  loading: boolean
  error: string | null
  fetchIncoming: () => Promise<void>
  inviteMember: (boardId: string, boardTitle: string, boardColor: string, toUserId: string) => Promise<string | null>
  acceptInvite: (inviteId: string) => Promise<string | null>
  declineInvite: (inviteId: string) => Promise<void>
}

function single<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value
}

export const useBoardInvitesStore = create<BoardInvitesState>()((set, get) => ({
  incoming: [],
  loading: false,
  error: null,

  fetchIncoming: async () => {
    set({ loading: true, error: null })
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      set({ loading: false })
      return
    }

    const { data, error } = await supabase
      .from('board_invites')
      .select('id, board_id, board_title, board_color, from_user:profiles!board_invites_from_user_id_fkey(*)')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      set({ loading: false, error: error.message })
      return
    }

    const rows = (data ?? []) as unknown as BoardInviteRow[]
    const incoming: IncomingBoardInvite[] = rows
      .map((row) => ({
        id: row.id,
        boardId: row.board_id,
        boardTitle: row.board_title,
        boardColor: row.board_color,
        fromUser: single(row.from_user),
      }))
      .filter((row) => row.fromUser)

    set({ incoming, loading: false })
  },

  inviteMember: async (boardId, boardTitle, boardColor, toUserId) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return 'Nicht angemeldet'

    const { data: existing } = await supabase
      .from('board_invites')
      .select('id')
      .eq('board_id', boardId)
      .eq('to_user_id', toUserId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) return 'Einladung bereits gesendet'

    const { error } = await supabase.from('board_invites').insert({
      board_id: boardId,
      from_user_id: userId,
      to_user_id: toUserId,
      status: 'pending',
      board_title: boardTitle,
      board_color: boardColor,
    })

    if (error) return error.message
    return null
  },

  acceptInvite: async (inviteId) => {
    const invite = get().incoming.find((i) => i.id === inviteId)
    if (!invite) return null

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return 'Nicht angemeldet'

    const { error: memberError } = await supabase
      .from('board_members')
      .insert({ board_id: invite.boardId, user_id: userId, role: 'member' })

    if (memberError && memberError.code !== '23505') return memberError.message

    await supabase.from('board_invites').update({ status: 'accepted' }).eq('id', inviteId)
    set((state) => ({ incoming: state.incoming.filter((i) => i.id !== inviteId) }))
    await useBoardsStore.getState().fetchBoards()
    return null
  },

  declineInvite: async (inviteId) => {
    await supabase.from('board_invites').update({ status: 'declined' }).eq('id', inviteId)
    set((state) => ({ incoming: state.incoming.filter((i) => i.id !== inviteId) }))
  },
}))
