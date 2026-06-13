import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface Comment {
  id: string
  authorId: string
  authorName: string
  authorColor: string
  body: string
  createdAt: string
}

interface CommentRow {
  id: string
  author_id: string
  body: string
  created_at: string
  author: { display_name: string; avatar_color: string } | { display_name: string; avatar_color: string }[]
}

function single<T>(v: T | T[]): T {
  return Array.isArray(v) ? v[0] : v
}

interface CommentsState {
  comments: Record<string, Comment[]> // keyed by taskId or boardId
  loading: boolean
  fetch: (id: string) => Promise<void>
  add: (params: {
    body: string
    taskId?: string
    boardId?: string
    mentionedUserIds: string[]
  }) => Promise<void>
  remove: (commentId: string, contextId: string) => Promise<void>
}

export const useCommentsStore = create<CommentsState>()((set, get) => ({
  comments: {},
  loading: false,

  fetch: async (id) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('comments')
      .select('id, author_id, body, created_at, author:profiles!comments_author_id_fkey(display_name, avatar_color)')
      .or(`task_id.eq.${id},board_id.eq.${id}`)
      .order('created_at', { ascending: true })

    if (!error && data) {
      const comments = (data as unknown as CommentRow[]).map((row) => {
        const a = single(row.author)
        return {
          id: row.id,
          authorId: row.author_id,
          authorName: a.display_name,
          authorColor: a.avatar_color,
          body: row.body,
          createdAt: row.created_at,
        }
      })
      set((s) => ({ comments: { ...s.comments, [id]: comments }, loading: false }))
    } else {
      set({ loading: false })
    }
  },

  add: async ({ body, taskId, boardId, mentionedUserIds }) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from('comments')
      .insert({
        author_id: userId,
        body,
        task_id: taskId ?? null,
        board_id: boardId ?? null,
      })
      .select('id')
      .single()

    if (error || !data) return

    if (mentionedUserIds.length > 0) {
      await supabase.rpc('notify_mentions', {
        p_comment_id: data.id,
        p_author_id: userId,
        p_body: body,
        p_task_id: taskId ?? null,
        p_board_id: boardId ?? null,
        p_mentioned_user_ids: mentionedUserIds,
      })
    }

    const contextId = taskId ?? boardId!
    await get().fetch(contextId)
  },

  remove: async (commentId, contextId) => {
    await supabase.from('comments').delete().eq('id', commentId)
    set((s) => ({
      comments: {
        ...s.comments,
        [contextId]: (s.comments[contextId] ?? []).filter((c) => c.id !== commentId),
      },
    }))
  },
}))
