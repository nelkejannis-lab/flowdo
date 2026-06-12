import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalendarEvent } from '../types'
import { createId } from '../utils/id'

interface NewEventInput {
  title: string
  date: string
  endDate?: string
  description?: string
  color: string
}

interface EventsState {
  events: CalendarEvent[]
  addEvent: (input: NewEventInput) => CalendarEvent
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void
  deleteEvent: (id: string) => void
}

export const useEventsStore = create<EventsState>()(
  persist(
    (set) => ({
      events: [],

      addEvent: (input) => {
        const event: CalendarEvent = {
          id: createId(),
          title: input.title,
          date: input.date,
          endDate: input.endDate,
          description: input.description,
          color: input.color,
          createdAt: new Date().toISOString(),
        }
        set((state) => ({ events: [...state.events, event] }))
        return event
      },

      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        }))
      },

      deleteEvent: (id) => {
        set((state) => ({ events: state.events.filter((e) => e.id !== id) }))
      },
    }),
    { name: 'flowdo-events' }
  )
)

export const EVENT_COLORS = [
  '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#EF4444',
]
