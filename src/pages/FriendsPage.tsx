import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Pencil, Plus, Trash2, UserPlus, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFriendsStore } from '../store/friendsStore'
import { useTeamsStore } from '../store/teamsStore'
import { useTeamInvitesStore } from '../store/teamInvitesStore'
import { useAuthStore } from '../store/authStore'
import type { Profile } from '../store/authStore'
import UserAvatar from '../components/shared/UserAvatar'
import BadgeChip from '../components/ui/BadgeChip'

export default function FriendsPage() {
  const { t } = useTranslation(['friends', 'common'])
  const profile = useAuthStore((s) => s.profile)
  const setBadgeForUser = useAuthStore((s) => s.setBadgeForUser)
  const isAdmin = profile?.is_admin ?? false
  const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null)
  const [badgeInput, setBadgeInput] = useState('')

  async function saveBadge(userId: string) {
    await setBadgeForUser(userId, badgeInput.trim() || null)
    setEditingBadgeId(null)
    await fetchAll()
  }

  const {
    friends,
    incoming,
    outgoing,
    loading,
    fetchAll,
    searchUsers,
    sendRequest,
    acceptRequest,
    declineOrCancel,
    removeFriend,
  } = useFriendsStore()
  const teams = useTeamsStore((s) => s.teams)
  const fetchTeams = useTeamsStore((s) => s.fetch)
  const createTeam = useTeamsStore((s) => s.create)
  const renameTeam = useTeamsStore((s) => s.rename)
  const removeTeam = useTeamsStore((s) => s.remove)
  const removeMember = useTeamsStore((s) => s.removeMember)
  const sendInvite = useTeamInvitesStore((s) => s.sendInvite)
  const [inviteSent, setInviteSent] = useState<Record<string, boolean>>({})

  const [newTeamName, setNewTeamName] = useState('')
  const [showNewTeam, setShowNewTeam] = useState(false)
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null)
  const [editingTeamName, setEditingTeamName] = useState('')
  const [openTeamId, setOpenTeamId] = useState<string | null>(null)

  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [suggestions, setSuggestions] = useState<Profile[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchAll()
    fetchTeams()
  }, [fetchAll, fetchTeams])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    if (!username.trim()) {
      setSuggestions([])
      return
    }
    searchTimeout.current = setTimeout(async () => {
      const results = await searchUsers(username)
      setSuggestions(results)
    }, 250)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [username, searchUsers])

  function selectSuggestion(profile: Profile) {
    setUsername(profile.username)
    setSuggestions([])
    setShowSuggestions(false)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSending(true)
    setShowSuggestions(false)
    const err = await sendRequest(username)
    setSending(false)
    if (err) setError(err)
    else {
      setSuccess(t('addPerson.successMessage', { username: username.trim().toLowerCase() }))
      setUsername('')
      setSuggestions([])
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">{t('title')}</h1>

      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <h2 className="mb-2 text-sm font-semibold">{t('addPerson.heading')}</h2>
        <form onSubmit={handleSend} className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              placeholder={t('addPerson.placeholder')}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-racing-700 dark:bg-racing-900">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectSuggestion(p)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-racing-800"
                  >
                    <UserAvatar name={p.display_name} color={p.avatar_color} avatarUrl={p.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.display_name}</p>
                      <p className="truncate text-xs text-gray-400">@{p.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={sending || !username.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            <UserPlus size={16} />
            {t('addPerson.submit')}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {success && <p className="mt-2 text-sm text-emerald-500">{success}</p>}
      </div>

      {incoming.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">{t('incomingRequests.heading')}</h2>
          <div className="flex flex-col gap-2">
            {incoming.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
              >
                <UserAvatar name={req.profile.display_name} color={req.profile.avatar_color} avatarUrl={(req.profile as any).avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{req.profile.display_name}</p>
                  <p className="truncate text-xs text-gray-400">@{req.profile.username}</p>
                </div>
                <button
                  onClick={() => acceptRequest(req.id)}
                  className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                >
                  <Check size={14} />
                  {t('incomingRequests.accept')}
                </button>
                <button
                  onClick={() => declineOrCancel(req.id)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                >
                  <X size={14} />
                  {t('incomingRequests.decline')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">{t('outgoingRequests.heading')}</h2>
          <div className="flex flex-col gap-2">
            {outgoing.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
              >
                <UserAvatar name={req.profile.display_name} color={req.profile.avatar_color} avatarUrl={(req.profile as any).avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{req.profile.display_name}</p>
                  <p className="truncate text-xs text-gray-400">@{req.profile.username}</p>
                </div>
                <span className="text-xs text-gray-400">{t('outgoingRequests.pending')}</span>
                <button
                  onClick={() => declineOrCancel(req.id)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                >
                  <X size={14} />
                  {t('outgoingRequests.withdraw')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('friendsList.heading', { count: friends.length })}</h2>
        {loading ? (
          <p className="text-sm text-gray-400">{t('common:loading')}</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-gray-400">{t('friendsList.empty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
              >
                <UserAvatar name={f.profile.display_name} color={f.profile.avatar_color} avatarUrl={(f.profile as any).avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="truncate text-sm font-medium">{f.profile.display_name}</p>
                    <BadgeChip badge={(f.profile as any).badge} size="xs" />
                  </div>
                  <p className="truncate text-xs text-gray-400">@{f.profile.username}</p>
                  {/* Admin badge editor */}
                  {isAdmin && editingBadgeId === f.profile.id ? (
                    <div className="mt-1.5 flex items-center gap-1">
                      <input
                        autoFocus
                        value={badgeInput}
                        onChange={(e) => setBadgeInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveBadge(f.profile.id); if (e.key === 'Escape') setEditingBadgeId(null) }}
                        placeholder="Badge-Titel..."
                        className="flex-1 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs focus:border-accent focus:outline-none dark:border-racing-700"
                      />
                      <button onClick={() => saveBadge(f.profile.id)} className="text-emerald-500 hover:text-emerald-600"><Check size={13} /></button>
                      <button onClick={() => setEditingBadgeId(null)} className="text-gray-400 hover:text-red-500"><X size={13} /></button>
                    </div>
                  ) : isAdmin ? (
                    <button
                      onClick={() => { setEditingBadgeId(f.profile.id); setBadgeInput((f.profile as any).badge ?? '') }}
                      className="mt-0.5 flex items-center gap-0.5 text-[10px] text-gray-400 hover:text-accent"
                    >
                      <Pencil size={9} /> {t('badge.assign')}
                    </button>
                  ) : null}
                </div>
                <button
                  onClick={() => removeFriend(f.id)}
                  title={t('friendsList.remove')}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-racing-800"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Teams */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users size={18} />
            {t('teams.heading')}
          </h2>
          <button
            onClick={() => setShowNewTeam((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-racing-700 dark:text-racing-100 dark:hover:bg-racing-800"
          >
            <Plus size={15} />
            {t('teams.create')}
          </button>
        </div>

        {showNewTeam && (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!newTeamName.trim()) return
              await createTeam(newTeamName.trim())
              setNewTeamName('')
              setShowNewTeam(false)
            }}
            className="mb-4 flex items-center gap-2"
          >
            <input
              autoFocus
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder={t('teams.namePlaceholder')}
              className="flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700 sm:w-64 sm:flex-none"
            />
            <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark">{t('teams.createSubmit')}</button>
            <button type="button" onClick={() => setShowNewTeam(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-racing-700">{t('teams.cancel')}</button>
          </form>
        )}

        {teams.length === 0 ? (
          <p className="text-sm text-gray-400">{t('teams.empty')}</p>
        ) : (
          <div className="flex flex-col gap-3">
            {teams.map((team) => {
              const isOpen = openTeamId === team.id
              const isEditing = editingTeamId === team.id
              const teamMemberIds = team.members.map((m) => m.id)
              const availableFriends = friends.filter((f) => !teamMemberIds.includes(f.profile.id))

              return (
                <div key={team.id} className="rounded-xl border border-gray-100 bg-white dark:border-racing-800 dark:bg-racing-900">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button
                      onClick={() => setOpenTeamId(isOpen ? null : team.id)}
                      className="rounded p-0.5 text-gray-400 hover:text-gray-600"
                    >
                      <ChevronDown size={16} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    </button>

                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          value={editingTeamName}
                          onChange={(e) => setEditingTeamName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { renameTeam(team.id, editingTeamName.trim()); setEditingTeamId(null) }
                            if (e.key === 'Escape') setEditingTeamId(null)
                          }}
                          className="flex-1 rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-sm font-semibold focus:border-accent focus:outline-none dark:border-racing-700"
                        />
                        <button onClick={() => { renameTeam(team.id, editingTeamName.trim()); setEditingTeamId(null) }} className="text-gray-400 hover:text-emerald-500"><Check size={15} /></button>
                        <button onClick={() => setEditingTeamId(null)} className="text-gray-400 hover:text-red-500"><X size={15} /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm font-semibold">{team.name}</span>
                        <span className="text-xs text-gray-400">{t('teams.members', { count: team.members.length })}</span>
                        <button onClick={() => { setEditingTeamId(team.id); setEditingTeamName(team.name) }} className="rounded p-1 text-gray-400 hover:text-accent"><Pencil size={13} /></button>
                        <button onClick={() => { if (confirm(t('teams.deleteConfirm', { name: team.name }))) removeTeam(team.id) }} className="rounded p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100 px-4 py-3 dark:border-racing-800">
                      {/* Current members */}
                      {team.members.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {team.members.map((m) => (
                            <span key={m.id} className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 pl-1 pr-2 py-0.5">
                              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: m.avatar_color }}>
                                {m.display_name.slice(0, 2).toUpperCase()}
                              </span>
                              <span className="text-xs font-medium text-accent">{m.display_name}</span>
                              <button onClick={() => removeMember(team.id, m.id)} className="ml-0.5 text-accent/60 hover:text-red-500">
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add friend to team */}
                      {availableFriends.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs text-gray-400">{t('teams.invite')}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {availableFriends.map((f) => {
                              const key = `${team.id}:${f.profile.id}`
                              const sent = inviteSent[key]
                              return (
                                <button
                                  key={f.profile.id}
                                  disabled={sent}
                                  onClick={async () => {
                                    const err = await sendInvite(team.id, team.name, f.profile.id)
                                    if (!err) setInviteSent((s) => ({ ...s, [key]: true }))
                                  }}
                                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                                    sent
                                      ? 'border-emerald-300 bg-emerald-50 text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                                      : 'border-gray-200 text-gray-500 hover:border-accent hover:text-accent dark:border-racing-700 dark:text-racing-200'
                                  }`}
                                >
                                  {sent ? <Check size={11} /> : <Plus size={11} />}
                                  {f.profile.display_name}
                                  {sent && t('teams.invited')}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {friends.length === 0 && (
                        <p className="text-xs text-gray-400">{t('teams.noFriends')}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
