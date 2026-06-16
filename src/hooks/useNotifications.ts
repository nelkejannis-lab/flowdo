import { useEffect, useRef } from 'react'
import { useCalendarEntriesStore } from '../store/calendarEntriesStore'
import { useMessagesStore } from '../store/messagesStore'
import { useProjectTasksStore } from '../store/projectTasksStore'
import { useAuthStore } from '../store/authStore'
import { useSettingsStore } from '../store/settingsStore'
import { notify } from '../utils/notifications'
import { todayISO } from '../utils/date'

export function useNotifications() {
  const notifyAppts = useSettingsStore((s) => s.notifyAppointments)
  const notifyChat = useSettingsStore((s) => s.notifyChat)
  const notifyTasks = useSettingsStore((s) => s.notifyTasks)
  const reminderMinutes = useSettingsStore((s) => s.appointmentReminderMinutes)

  const entries = useCalendarEntriesStore((s) => s.entries)
  const unreadTotal = useMessagesStore((s) => s.unreadTotal)
  const conversations = useMessagesStore((s) => s.conversations)
  const myTasks = useProjectTasksStore((s) => s.myTasks)
  const currentUserId = useAuthStore((s) => s.user?.id)

  // Track what we've already notified about this session
  const notifiedAppts = useRef<Set<string>>(new Set())
  const prevUnread = useRef<number>(unreadTotal)
  const prevTaskIds = useRef<Set<string>>(new Set(myTasks.map((t) => t.id)))
  const initialized = useRef(false)

  // Appointment reminders: poll every minute
  useEffect(() => {
    if (!notifyAppts) return

    function checkAppointments() {
      const now = new Date()
      const today = todayISO()
      const nowMinutes = now.getHours() * 60 + now.getMinutes()

      for (const entry of entries) {
        if (!entry.startTime) continue
        if (entry.date !== today) continue

        const [h, m] = entry.startTime.split(':').map(Number)
        const entryMinutes = h * 60 + m
        const diff = entryMinutes - nowMinutes

        if (diff > 0 && diff <= reminderMinutes) {
          const key = `${entry.id}-${reminderMinutes}`
          if (!notifiedAppts.current.has(key)) {
            notifiedAppts.current.add(key)
            notify(
              `📅 ${entry.title}`,
              diff === 1
                ? 'Startet in 1 Minute'
                : `Startet in ${diff} Minuten (${entry.startTime} Uhr)`,
              key
            )
          }
        }
      }
    }

    checkAppointments()
    const interval = setInterval(checkAppointments, 60_000)
    return () => clearInterval(interval)
  }, [notifyAppts, entries, reminderMinutes])

  // Chat notifications: detect new unread messages
  useEffect(() => {
    if (!initialized.current) {
      prevUnread.current = unreadTotal
      return
    }
    if (!notifyChat) return
    if (unreadTotal > prevUnread.current) {
      const newUnreadConv = conversations.find(
        (c) => c.unreadCount > 0 && c.profile.id !== currentUserId
      )
      notify(
        '💬 Neue Nachricht',
        newUnreadConv
          ? `${newUnreadConv.profile.display_name}: ${newUnreadConv.lastMessage?.body?.slice(0, 60) ?? ''}`
          : 'Du hast eine neue Nachricht erhalten.',
        'chat-new'
      )
    }
    prevUnread.current = unreadTotal
  }, [unreadTotal, notifyChat, conversations, currentUserId])

  // Task notifications: detect newly assigned tasks
  useEffect(() => {
    if (!initialized.current) {
      prevTaskIds.current = new Set(myTasks.map((t) => t.id))
      initialized.current = true
      return
    }
    if (!notifyTasks || !currentUserId) return

    for (const task of myTasks) {
      if (!prevTaskIds.current.has(task.id) && task.assignedTo === currentUserId) {
        notify(
          '✅ Neue Aufgabe zugewiesen',
          task.title,
          `task-${task.id}`
        )
      }
    }
    prevTaskIds.current = new Set(myTasks.map((t) => t.id))
  }, [myTasks, notifyTasks, currentUserId])
}
