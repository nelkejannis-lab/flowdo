import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { useMessagesStore } from '../store/messagesStore'
import { useFriendsStore } from '../store/friendsStore'
import { useAuthStore } from '../store/authStore'
import { isSupabaseConfigured } from '../lib/supabase'

export default function ChatPage() {
  const conversations = useMessagesStore((s) => s.conversations)
  const messages = useMessagesStore((s) => s.messages)
  const fetchConversations = useMessagesStore((s) => s.fetchConversations)
  const fetchMessages = useMessagesStore((s) => s.fetchMessages)
  const sendMessage = useMessagesStore((s) => s.sendMessage)
  const markRead = useMessagesStore((s) => s.markRead)
  const subscribeToMessages = useMessagesStore((s) => s.subscribeToMessages)
  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const currentUserId = useAuthStore((s) => s.user?.id)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    fetchFriends()
    fetchConversations()
  }, [fetchFriends, fetchConversations])

  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured) return
    const unsub = subscribeToMessages(currentUserId, () => {
      if (activeId) fetchMessages(activeId)
    })
    return unsub
  }, [currentUserId, activeId, subscribeToMessages, fetchMessages])

  useEffect(() => {
    if (!activeId) return
    fetchMessages(activeId)
    markRead(activeId)
  }, [activeId, fetchMessages, markRead])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeId])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!activeId || !input.trim()) return
    setSending(true)
    await sendMessage(activeId, input)
    setInput('')
    setSending(false)
    inputRef.current?.focus()
  }

  const allContacts = [
    ...friends.map((f) => f.profile),
    ...conversations
      .map((c) => c.profile)
      .filter((p) => !friends.some((f) => f.profile.id === p.id)),
  ]

  const activeProfile = allContacts.find((p) => p.id === activeId)
  const activeMessages = activeId ? (messages[activeId] ?? []) : []

  function formatTime(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    return isToday
      ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  }

  function formatLastTime(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    return isToday
      ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  // Group messages by date
  function groupByDate(msgs: typeof activeMessages) {
    const groups: { label: string; messages: typeof activeMessages }[] = []
    let currentLabel = ''
    for (const msg of msgs) {
      const d = new Date(msg.createdAt)
      const now = new Date()
      const isToday = d.toDateString() === now.toDateString()
      const isYesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString()
      const label = isToday ? 'Heute' : isYesterday ? 'Gestern' : d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
      if (label !== currentLabel) {
        currentLabel = label
        groups.push({ label, messages: [] })
      }
      groups[groups.length - 1].messages.push(msg)
    }
    return groups
  }

  return (
    // Full viewport height, no outer padding
    <div className="-mx-4 -my-4 flex h-[calc(100vh-64px)] flex-col overflow-hidden sm:-mx-6 sm:-my-6 sm:h-[calc(100vh-64px)]">

      {/* === CONVERSATION LIST (shown when no active chat on mobile) === */}
      <div className={`flex flex-col bg-white dark:bg-racing-950 ${activeId ? 'hidden sm:flex sm:w-72 sm:flex-shrink-0 sm:border-r sm:border-gray-100 sm:dark:border-racing-800' : 'flex-1'}`}>

        {/* Header */}
        <div className="bg-accent px-4 py-3 pt-safe">
          <h1 className="text-base font-semibold text-white">Chats</h1>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-racing-800">
          {allContacts.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Füge zuerst Kollegen hinzu um zu chatten.
            </p>
          )}
          {allContacts.map((profile) => {
            const conv = conversations.find((c) => c.profile.id === profile.id)
            const unread = conv?.unreadCount ?? 0
            return (
              <button
                key={profile.id}
                onClick={() => setActiveId(profile.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-gray-50 dark:active:bg-racing-800"
              >
                {/* Avatar */}
                <span
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ backgroundColor: profile.avatar_color }}
                >
                  {profile.display_name.slice(0, 2).toUpperCase()}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[15px] font-medium">{profile.display_name}</p>
                    {conv?.lastMessage && (
                      <span className={`flex-shrink-0 text-xs ${unread > 0 ? 'font-semibold text-accent' : 'text-gray-400'}`}>
                        {formatLastTime(conv.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-gray-500 dark:text-racing-300">
                      {conv?.lastMessage
                        ? (conv.lastMessage.fromUserId === currentUserId ? '✓ ' : '') + conv.lastMessage.body
                        : 'Noch keine Nachrichten'}
                    </p>
                    {unread > 0 && (
                      <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* === CHAT VIEW (shown when active chat) === */}
      {activeId && (
        <div className="flex flex-1 flex-col overflow-hidden sm:flex-row">
          {/* Sidebar on desktop */}
          <div className="hidden sm:flex sm:w-72 sm:flex-shrink-0 sm:flex-col sm:border-r sm:border-gray-100 sm:dark:border-racing-800">
            <div className="bg-accent px-4 py-3">
              <h1 className="text-base font-semibold text-white">Chats</h1>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-racing-800">
              {allContacts.map((profile) => {
                const conv = conversations.find((c) => c.profile.id === profile.id)
                const unread = conv?.unreadCount ?? 0
                const isActive = profile.id === activeId
                return (
                  <button
                    key={profile.id}
                    onClick={() => setActiveId(profile.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left ${isActive ? 'bg-accent/10' : 'hover:bg-gray-50 dark:hover:bg-racing-800'}`}
                  >
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: profile.avatar_color }}>
                      {profile.display_name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className={`truncate text-sm font-medium ${isActive ? 'text-accent' : ''}`}>{profile.display_name}</p>
                        {conv?.lastMessage && <span className="text-[11px] text-gray-400">{formatLastTime(conv.lastMessage.createdAt)}</span>}
                      </div>
                      <p className="truncate text-xs text-gray-400">{conv?.lastMessage?.body ?? ''}</p>
                    </div>
                    {unread > 0 && <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">{unread}</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Chat column */}
          <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-racing-950">
            {/* Chat header */}
            <div className="flex items-center gap-3 bg-accent px-4 py-3">
              <button onClick={() => setActiveId(null)} className="mr-1 text-white/80 hover:text-white sm:hidden">
                <ArrowLeft size={22} />
              </button>
              {activeProfile && (
                <>
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                    {activeProfile.display_name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-white">{activeProfile.display_name}</p>
                    <p className="text-xs text-white/70">@{activeProfile.username}</p>
                  </div>
                </>
              )}
            </div>

            {/* Messages — WhatsApp-style bg */}
            <div
              className="flex-1 overflow-y-auto px-4 py-3"
              style={{
                backgroundImage: 'radial-gradient(circle, #e5e5e5 1px, transparent 1px)',
                backgroundSize: '20px 20px',
              }}
            >
              <div className="dark:hidden" />
              {activeMessages.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <p className="rounded-xl bg-white/80 px-4 py-2 text-xs text-gray-500 shadow-sm dark:bg-racing-800/80 dark:text-racing-300">
                    Noch keine Nachrichten — schreib etwas! 👋
                  </p>
                </div>
              )}

              {groupByDate(activeMessages).map((group) => (
                <div key={group.label}>
                  {/* Date divider */}
                  <div className="my-3 flex items-center justify-center">
                    <span className="rounded-full bg-white/80 px-3 py-0.5 text-[11px] text-gray-500 shadow-sm dark:bg-racing-800/80 dark:text-racing-300">
                      {group.label}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    {group.messages.map((msg, i) => {
                      const isMe = msg.fromUserId === currentUserId
                      const prevMsg = group.messages[i - 1]
                      const isSameSender = prevMsg && prevMsg.fromUserId === msg.fromUserId
                      return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isSameSender ? 'mt-0.5' : 'mt-2'}`}>
                          <div className={`relative max-w-[78%] rounded-2xl px-3 py-2 shadow-sm ${
                            isMe
                              ? 'rounded-tr-sm bg-accent text-white'
                              : 'rounded-tl-sm bg-white text-gray-800 dark:bg-racing-800 dark:text-racing-100'
                          }`}>
                            <p className="text-[15px] leading-relaxed">{msg.body}</p>
                            <div className={`mt-0.5 flex items-center justify-end gap-1 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                              <span className="text-[11px]">{formatTime(msg.createdAt)}</span>
                              {isMe && (
                                <span className="text-[11px]">{msg.read ? '✓✓' : '✓'}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-2 dark:border-racing-800 dark:bg-racing-900"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nachricht…"
                className="flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-[15px] focus:outline-none dark:bg-racing-800 dark:text-racing-100"
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-40"
              >
                <Send size={17} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
