import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface Notification {
  id: string
  type: 'mention' | 'task_share' | 'board_invite' | 'birthday' | 'question'
  title: string
  body: string | null
  link: string | null
  read: boolean
  createdAt: string
}

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  fetch: () => Promise<void>
  checkBirthdays: () => Promise<void>
  askQuestion: (toUserId: string, taskId: string, taskTitle: string, question: string) => Promise<string | null>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
}

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,

  fetch: async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      const notifications = (data as Record<string, unknown>[]).map((n) => ({
        id: n.id as string,
        type: n.type as Notification['type'],
        title: n.title as string,
        body: n.body as string | null,
        link: n.link as string | null,
        read: n.read as boolean,
        createdAt: n.created_at as string,
      }))
      set({
        notifications,
        unreadCount: notifications.filter((n) => !n.read).length,
      })
    }
  },

  checkBirthdays: async () => {
    await supabase.rpc('create_birthday_notifications_for_today')
  },

  askQuestion: async (toUserId, taskId, taskTitle, question) => {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return 'Nicht angemeldet'

    // Use security definer function to bypass RLS
    const { error } = await supabase.rpc('send_question_notification', {
      p_to_user_id: toUserId,
      p_task_id: taskId,
      p_task_title: taskTitle,
      p_question: question,
    })

    if (error) return error.message

    // Also post as comment on the task so it's visible there too
    await supabase.from('comments').insert({
      author_id: userId,
      task_id: taskId,
      body: `❓ ${question}`,
    })

    return null
  },

  markRead: async (id) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    set((s) => ({
      notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }))
  },

  markAllRead: async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false)
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }))
  },
}))
