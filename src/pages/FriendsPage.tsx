import { useEffect, useRef, useState } from 'react'
import { Check, UserPlus, X } from 'lucide-react'
import { useFriendsStore } from '../store/friendsStore'
import type { Profile } from '../store/authStore'

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}

export default function FriendsPage() {
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
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [suggestions, setSuggestions] = useState<Profile[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

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
      setSuccess(`Anfrage an @${username.trim().toLowerCase()} gesendet`)
      setUsername('')
      setSuggestions([])
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Kollegen</h1>

      <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
        <h2 className="mb-2 text-sm font-semibold">Person hinzufügen</h2>
        <form onSubmit={handleSend} className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
              placeholder="Benutzername oder Name suchen"
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
                    <Avatar name={p.display_name} color={p.avatar_color} />
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
            Anfrage senden
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {success && <p className="mt-2 text-sm text-emerald-500">{success}</p>}
      </div>

      {incoming.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Anfragen</h2>
          <div className="flex flex-col gap-2">
            {incoming.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
              >
                <Avatar name={req.profile.display_name} color={req.profile.avatar_color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{req.profile.display_name}</p>
                  <p className="truncate text-xs text-gray-400">@{req.profile.username}</p>
                </div>
                <button
                  onClick={() => acceptRequest(req.id)}
                  className="flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-dark"
                >
                  <Check size={14} />
                  Annehmen
                </button>
                <button
                  onClick={() => declineOrCancel(req.id)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                >
                  <X size={14} />
                  Ablehnen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Gesendete Anfragen</h2>
          <div className="flex flex-col gap-2">
            {outgoing.map((req) => (
              <div
                key={req.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
              >
                <Avatar name={req.profile.display_name} color={req.profile.avatar_color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{req.profile.display_name}</p>
                  <p className="truncate text-xs text-gray-400">@{req.profile.username}</p>
                </div>
                <span className="text-xs text-gray-400">Ausstehend</span>
                <button
                  onClick={() => declineOrCancel(req.id)}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
                >
                  <X size={14} />
                  Zurückziehen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Kollegen ({friends.length})</h2>
        {loading ? (
          <p className="text-sm text-gray-400">Lädt…</p>
        ) : friends.length === 0 ? (
          <p className="text-sm text-gray-400">Noch keine Kollegen hinzugefügt.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {friends.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900"
              >
                <Avatar name={f.profile.display_name} color={f.profile.avatar_color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.profile.display_name}</p>
                  <p className="truncate text-xs text-gray-400">@{f.profile.username}</p>
                </div>
                <button
                  onClick={() => removeFriend(f.id)}
                  title="Entfernen"
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-racing-800"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
