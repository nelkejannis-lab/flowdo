import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
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

  // Real-time subscription
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

  // All people to chat with = friends + existing conversations
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
      : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-racing-800 dark:bg-racing-900">
      {/* Sidebar — conversations */}
      <div className="flex w-64 flex-shrink-0 flex-col border-r border-gray-100 dark:border-racing-800">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-racing-800">
          <h2 className="text-sm font-semibold">Nachrichten</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {allContacts.length === 0 && (
            <p className="px-4 py-6 text-xs text-gray-400">Füge zuerst Kollegen hinzu.</p>
          )}
          {allContacts.map((profile) => {
            const conv = conversations.find((c) => c.profile.id === profile.id)
            const unread = conv?.unreadCount ?? 0
            const active = activeId === profile.id
            return (
              <button
                key={profile.id}
                onClick={() => setActiveId(profile.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                  active ? 'bg-accent/10' : 'hover:bg-gray-50 dark:hover:bg-racing-800'
                }`}
              >
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: profile.avatar_color }}
                >
                  {profile.display_name.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-medium ${active ? 'text-accent' : ''}`}>
                    {profile.display_name}
                  </p>
                  {conv?.lastMessage && (
                    <p className="truncate text-xs text-gray-400">
                      {conv.lastMessage.fromUserId === currentUserId ? 'Du: ' : ''}
                      {conv.lastMessage.body}
                    </p>
                  )}
                </div>
                {unread > 0 && (
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {!activeId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Wähle einen Kollegen um zu chatten
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-racing-800">
              {activeProfile && (
                <>
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: activeProfile.avatar_color }}
                  >
                    {activeProfile.display_name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-sm font-semibold">{activeProfile.display_name}</span>
                </>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {activeMessages.length === 0 && (
                <p className="text-center text-xs text-gray-400">Noch keine Nachrichten. Schreib etwas!</p>
              )}
              <div className="flex flex-col gap-2">
                {activeMessages.map((msg) => {
                  const isMe = msg.fromUserId === currentUserId
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                        isMe
                          ? 'rounded-tr-sm bg-accent text-white'
                          : 'rounded-tl-sm bg-gray-100 text-gray-800 dark:bg-racing-800 dark:text-racing-100'
                      }`}>
                        <p className="leading-relaxed">{msg.body}</p>
                        <p className={`mt-0.5 text-right text-[10px] ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                          {formatTime(msg.createdAt)}
                          {isMe && msg.read && ' ✓✓'}
                        </p>
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 px-4 py-3 dark:border-racing-800">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nachricht schreiben…"
                className="flex-1 rounded-full border border-gray-200 bg-transparent px-4 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) } }}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-dark disabled:opacity-50"
              >
                <Send size={15} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
