import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Send } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMessagesStore } from '../store/messagesStore'
import { useFriendsStore } from '../store/friendsStore'
import { useTeamsStore } from '../store/teamsStore'
import { useAuthStore } from '../store/authStore'
import { isSupabaseConfigured } from '../lib/supabase'
import UserAvatar from '../components/shared/UserAvatar'

type ChatTarget = { type: 'dm'; userId: string } | { type: 'team'; teamId: string; teamName: string }

export default function ChatPage() {
  const { t, i18n } = useTranslation('chat')
  const conversations = useMessagesStore((s) => s.conversations)
  const messages = useMessagesStore((s) => s.messages)
  const teamMessages = useMessagesStore((s) => s.teamMessages)
  const fetchConversations = useMessagesStore((s) => s.fetchConversations)
  const fetchMessages = useMessagesStore((s) => s.fetchMessages)
  const sendMessage = useMessagesStore((s) => s.sendMessage)
  const markRead = useMessagesStore((s) => s.markRead)
  const fetchTeamMessages = useMessagesStore((s) => s.fetchTeamMessages)
  const sendTeamMessage = useMessagesStore((s) => s.sendTeamMessage)
  const subscribeToMessages = useMessagesStore((s) => s.subscribeToMessages)
  const subscribeToTeamMessages = useMessagesStore((s) => s.subscribeToTeamMessages)

  const friends = useFriendsStore((s) => s.friends)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const teams = useTeamsStore((s) => s.teams)
  const fetchTeams = useTeamsStore((s) => s.fetch)
  const currentUserId = useAuthStore((s) => s.user?.id)
  const currentProfile = useAuthStore((s) => s.profile)

  const [active, setActive] = useState<ChatTarget | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    fetchFriends(); fetchConversations(); fetchTeams()
  }, [fetchFriends, fetchConversations, fetchTeams])

  // Realtime DMs
  useEffect(() => {
    if (!currentUserId || !isSupabaseConfigured) return
    const unsub = subscribeToMessages(currentUserId, () => {
      if (active?.type === 'dm') fetchMessages(active.userId)
    })
    return unsub
  }, [currentUserId, active, subscribeToMessages, fetchMessages])

  // Realtime team
  useEffect(() => {
    if (active?.type !== 'team') return
    const unsub = subscribeToTeamMessages(active.teamId, () => {
      if (active?.type === 'team') fetchTeamMessages(active.teamId)
    })
    return unsub
  }, [active, subscribeToTeamMessages, fetchTeamMessages])

  useEffect(() => {
    if (!active) return
    if (active.type === 'dm') { fetchMessages(active.userId); markRead(active.userId) }
    if (active.type === 'team') fetchTeamMessages(active.teamId)
  }, [active, fetchMessages, markRead, fetchTeamMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, teamMessages, active])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!active || !input.trim()) return
    setSending(true)
    if (active.type === 'dm') await sendMessage(active.userId, input)
    else await sendTeamMessage(active.teamId, input)
    setInput('')
    setSending(false)
    inputRef.current?.focus()
  }

  const allContacts = [
    ...friends.map((f) => f.profile),
    ...conversations.map((c) => c.profile).filter((p) => !friends.some((f) => f.profile.id === p.id)),
  ]

  const activeProfile = active?.type === 'dm' ? allContacts.find((p) => p.id === active.userId) : null
  const activeTeam = active?.type === 'team' ? teams.find((t) => t.id === active.teamId) : null

  const activeMsgs = active?.type === 'dm' ? (messages[active.userId] ?? []) : []
  const activeTeamMsgs = active?.type === 'team' ? (teamMessages[active.teamId] ?? []) : []

  const locale = i18n.language === 'en' ? 'en-US' : 'de-DE'

  function formatTime(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
  }

  function groupByDate<T extends { createdAt: string }>(msgs: T[]) {
    const groups: { label: string; items: T[] }[] = []
    let cur = ''
    for (const msg of msgs) {
      const d = new Date(msg.createdAt)
      const now = new Date()
      const label = d.toDateString() === now.toDateString() ? t('dateGroups.today')
        : new Date(now.getTime() - 86400000).toDateString() === d.toDateString() ? t('dateGroups.yesterday')
        : d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' })
      if (label !== cur) { cur = label; groups.push({ label, items: [] }) }
      groups[groups.length - 1].items.push(msg)
    }
    return groups
  }

  const headerName = activeProfile?.display_name ?? activeTeam?.name ?? ''
  const headerSub = activeProfile ? `@${activeProfile.username}` : activeTeam ? t('members', { count: activeTeam.members.length }) : ''

  // Sidebar list
  function SidebarList({ onSelect }: { onSelect?: () => void }) {
    return (
      <div className="flex-1 overflow-y-auto">
        {teams.length > 0 && (
          <>
            <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-racing-400">{t('sections.teams')}</p>
            {teams.map((team) => {
              const isActive = active?.type === 'team' && active.teamId === team.id
              return (
                <button key={team.id} onClick={() => { setActive({ type: 'team', teamId: team.id, teamName: team.name }); onSelect?.() }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left ${isActive ? 'bg-accent/10' : 'hover:bg-gray-50 dark:hover:bg-racing-800'}`}>
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
                    {team.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-medium ${isActive ? 'text-accent' : ''}`}>{team.name}</p>
                    <p className="truncate text-xs text-gray-400">{t('members', { count: team.members.length })}</p>
                  </div>
                </button>
              )
            })}
          </>
        )}

        {allContacts.length > 0 && (
          <>
            <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-racing-400">{t('sections.directMessages')}</p>
            {allContacts.map((profile) => {
              const conv = conversations.find((c) => c.profile.id === profile.id)
              const unread = conv?.unreadCount ?? 0
              const isActive = active?.type === 'dm' && active.userId === profile.id
              return (
                <button key={profile.id} onClick={() => { setActive({ type: 'dm', userId: profile.id }); onSelect?.() }}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left ${isActive ? 'bg-accent/10' : 'hover:bg-gray-50 dark:hover:bg-racing-800'}`}>
                  <UserAvatar name={profile.display_name} color={profile.avatar_color} avatarUrl={profile.avatar_url} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`truncate text-[15px] font-medium ${isActive ? 'text-accent' : ''}`}>{profile.display_name}</p>
                      {conv?.lastMessage && <span className={`text-[11px] ${unread > 0 ? 'font-semibold text-accent' : 'text-gray-400'}`}>{formatTime(conv.lastMessage.createdAt)}</span>}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm text-gray-400">{conv?.lastMessage ? (conv.lastMessage.fromUserId === currentUserId ? t('youPrefix') : '') + conv.lastMessage.body : t('noMessagesPreview')}</p>
                      {unread > 0 && <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{unread}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </>
        )}

        {allContacts.length === 0 && teams.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-gray-400">{t('noContactsYet')}</p>
        )}
      </div>
    )
  }

  // Chat messages area
  function MessagesArea() {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-3"
        style={{ backgroundImage: 'radial-gradient(circle, #e5e5e5 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        {active?.type === 'dm' && activeMsgs.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="rounded-xl bg-white/80 px-4 py-2 text-xs text-gray-500 shadow-sm dark:bg-racing-800/80">{t('noMessagesYet')}</p>
          </div>
        )}
        {active?.type === 'team' && activeTeamMsgs.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <p className="rounded-xl bg-white/80 px-4 py-2 text-xs text-gray-500 shadow-sm dark:bg-racing-800/80">{t('noTeamMessagesYet')}</p>
          </div>
        )}

        {/* DM messages */}
        {active?.type === 'dm' && groupByDate(activeMsgs).map((group) => (
          <div key={group.label}>
            <div className="my-3 flex justify-center">
              <span className="rounded-full bg-white/80 px-3 py-0.5 text-[11px] text-gray-500 shadow-sm dark:bg-racing-800/80">{group.label}</span>
            </div>
            <div className="flex flex-col gap-1">
              {group.items.map((msg, i) => {
                const isMe = msg.fromUserId === currentUserId
                const isSame = i > 0 && group.items[i - 1].fromUserId === msg.fromUserId
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isSame ? 'mt-0.5' : 'mt-2'}`}>
                    <div className={`max-w-[78%] rounded-2xl px-3 py-2 shadow-sm ${isMe ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm bg-white text-gray-800 dark:bg-racing-800 dark:text-racing-100'}`}>
                      <p className="text-[15px] leading-relaxed">{msg.body}</p>
                      <div className={`mt-0.5 flex items-center justify-end gap-1 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                        <span className="text-[11px]">{formatTime(msg.createdAt)}</span>
                        {isMe && <span className="text-[11px]">{msg.read ? '✓✓' : '✓'}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Team messages */}
        {active?.type === 'team' && groupByDate(activeTeamMsgs).map((group) => (
          <div key={group.label}>
            <div className="my-3 flex justify-center">
              <span className="rounded-full bg-white/80 px-3 py-0.5 text-[11px] text-gray-500 shadow-sm dark:bg-racing-800/80">{group.label}</span>
            </div>
            <div className="flex flex-col gap-1">
              {group.items.map((msg, i) => {
                const isMe = msg.fromUserId === currentUserId
                const isSame = i > 0 && group.items[i - 1].fromUserId === msg.fromUserId
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${isSame ? 'mt-0.5' : 'mt-2'}`}>
                    <div className={`flex gap-2 max-w-[78%] ${isMe ? 'flex-row-reverse' : ''}`}>
                      {!isSame && !isMe && (
                        <UserAvatar name={msg.fromUser?.display_name ?? '?'} color={msg.fromUser?.avatar_color ?? '#888'} avatarUrl={(msg.fromUser as any)?.avatar_url} size="xs" className="mt-auto" />
                      )}
                      {isSame && !isMe && <div className="w-7 flex-shrink-0" />}
                      <div className={`rounded-2xl px-3 py-2 shadow-sm ${isMe ? 'rounded-tr-sm bg-accent text-white' : 'rounded-tl-sm bg-white text-gray-800 dark:bg-racing-800 dark:text-racing-100'}`}>
                        {!isSame && !isMe && <p className="mb-0.5 text-[11px] font-semibold" style={{ color: msg.fromUser?.avatar_color }}>{msg.fromUser?.display_name}</p>}
                        <p className="text-[15px] leading-relaxed">{msg.body}</p>
                        <span className={`mt-0.5 block text-right text-[11px] ${isMe ? 'text-white/60' : 'text-gray-400'}`}>{formatTime(msg.createdAt)}</span>
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
    )
  }

  return (
    <div className="flex h-[calc(100vh-120px)] overflow-hidden sm:h-[calc(100vh-96px)]">

      {/* MOBILE: list or chat */}
      {!active ? (
        <div className="flex flex-1 flex-col bg-white dark:bg-racing-950 sm:hidden">
          <div className="bg-accent px-4 py-3"><h1 className="text-base font-semibold text-white">{t('title')}</h1></div>
          <SidebarList />
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-racing-950 sm:hidden">
          <div className="flex items-center gap-3 bg-accent px-4 py-3">
            <button onClick={() => setActive(null)} className="mr-1 text-white/80 hover:text-white"><ArrowLeft size={22} /></button>
            {active.type === 'dm' && activeProfile
              ? <UserAvatar name={activeProfile.display_name} color={activeProfile.avatar_color} avatarUrl={activeProfile.avatar_url} size="md" />
              : <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">{headerName.slice(0, 2).toUpperCase()}</span>
            }
            <div><p className="text-[15px] font-semibold text-white">{headerName}</p><p className="text-xs text-white/70">{headerSub}</p></div>
          </div>
          <MessagesArea />
          <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-2 dark:border-racing-800 dark:bg-racing-900">
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('messagePlaceholder')}
              className="flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-[15px] focus:outline-none dark:bg-racing-800 dark:text-racing-100" />
            <button type="submit" disabled={!input.trim() || sending}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40">
              <Send size={17} />
            </button>
          </form>
        </div>
      )}

      {/* DESKTOP: sidebar + chat */}
      <div className="hidden flex-1 sm:flex">
        <div className="flex w-72 flex-shrink-0 flex-col border-r border-gray-100 bg-white dark:border-racing-800 dark:bg-racing-950">
          <div className="bg-accent px-4 py-3"><h1 className="text-base font-semibold text-white">{t('title')}</h1></div>
          <SidebarList />
        </div>

        {!active ? (
          <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-racing-900">
            <p className="text-sm text-gray-400">{t('selectChat')}</p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-3 bg-accent px-4 py-3">
              {active.type === 'dm' && activeProfile
                ? <UserAvatar name={activeProfile.display_name} color={activeProfile.avatar_color} avatarUrl={activeProfile.avatar_url} size="md" />
                : <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">{headerName.slice(0, 2).toUpperCase()}</span>
              }
              <div><p className="text-[15px] font-semibold text-white">{headerName}</p><p className="text-xs text-white/70">{headerSub}</p></div>
            </div>
            <MessagesArea />
            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-gray-100 bg-white px-3 py-2 dark:border-racing-800 dark:bg-racing-900">
              <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('messagePlaceholder')}
                className="flex-1 rounded-full bg-gray-100 px-4 py-2.5 text-[15px] focus:outline-none dark:bg-racing-800 dark:text-racing-100" />
              <button type="submit" disabled={!input.trim() || sending}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40">
                <Send size={17} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
