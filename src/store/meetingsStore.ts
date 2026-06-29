import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './authStore'

export interface ActionItemSubtask {
  id: string
  title: string
  done: boolean
}

export interface ActionItem {
  id: string
  task: string
  assignee?: string
  dueDate?: string
  done: boolean
  subtasks?: ActionItemSubtask[]
}

export interface Meeting {
  id: string
  user_id: string
  title: string
  date: string
  transcript: string
  summary: string
  action_items: ActionItem[]
  created_at: string
}

interface MeetingsState {
  meetings: Meeting[]
  loading: boolean
  error: string | null
  fetchMeetings: () => Promise<void>
  addMeeting: (meeting: Omit<Meeting, 'id' | 'user_id' | 'created_at'>) => Promise<Meeting | null>
  updateMeeting: (id: string, updates: Partial<Meeting>) => Promise<void>
  deleteMeeting: (id: string) => Promise<void>
}

export const useMeetingsStore = create<MeetingsState>((set, get) => ({
  meetings: [],
  loading: false,
  error: null,

  fetchMeetings: async () => {
    const user = useAuthStore.getState().user
    if (!user) return

    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      // Ignore error if table doesn't exist yet (for smooth local testing)
      if (error.code !== '42P01') {
        set({ error: error.message, loading: false })
      } else {
        set({ loading: false })
      }
      return
    }

    set({ meetings: data as Meeting[], loading: false })
  },

  addMeeting: async (meetingData) => {
    const user = useAuthStore.getState().user
    
    const newMeeting = {
      ...meetingData,
      user_id: user ? user.id : 'local-prototype-user',
    }

    // Try to insert into Supabase
    const { data, error } = await supabase
      .from('meetings')
      .insert([newMeeting])
      .select()
      .single()

    if (error) {
      console.warn("Supabase insert failed, falling back to local prototype mode:", error.message)
      const fakeMeeting: Meeting = {
        ...newMeeting,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString()
      }
      set((state) => ({ meetings: [fakeMeeting, ...state.meetings] }))
      return fakeMeeting
    }

    set((state) => ({ meetings: [data as Meeting, ...state.meetings] }))
    return data as Meeting
  },

  updateMeeting: async (id, updates) => {
    const { error } = await supabase
      .from('meetings')
      .update(updates)
      .eq('id', id)

    if (error && error.code !== '42P01') {
      set({ error: error.message })
      return
    }

    set((state) => ({
      meetings: state.meetings.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }))
  },

  deleteMeeting: async (id) => {
    const { error } = await supabase
      .from('meetings')
      .delete()
      .eq('id', id)

    if (error && error.code !== '42P01') {
      set({ error: error.message })
      return
    }

    set((state) => ({
      meetings: state.meetings.filter((m) => m.id !== id),
    }))
  },
}))
