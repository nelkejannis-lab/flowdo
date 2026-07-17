import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { UserPlus, X } from 'lucide-react'
import { useFriendsStore } from '../../store/friendsStore'
import { isSupabaseConfigured } from '../../lib/supabase'

interface ItemInviteModalProps {
  title: string
  onClose: () => void
  onInvite: (userId: string) => Promise<string | null>
}

export default function ItemInviteModal({ title, onClose, onInvite }: ItemInviteModalProps) {
  const { t } = useTranslation('brain')
  const searchAllProfiles = useFriendsStore((s) => s.searchAllProfiles)
  const fetchFriends = useFriendsStore((s) => s.fetchAll)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Array<{ id: string; display_name: string; username: string; avatar_color: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    if (isSupabaseConfigured) void fetchFriends()
  }, [fetchFriends])

  async function runSearch(value: string) {
    setQuery(value)
    setError(null)
    if (value.trim().length < 2) {
      setHits([])
      return
    }
    const results = await searchAllProfiles(value)
    setHits(results.map((p) => ({
      id: p.id,
      display_name: p.display_name,
      username: p.username,
      avatar_color: p.avatar_color,
    })))
  }

  async function send(userId: string) {
    setSending(userId)
    setError(null)
    const err = await onInvite(userId)
    setSending(null)
    if (err) {
      setError(err)
      return
    }
    setQuery('')
    setHits([])
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/45 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-racing-850 dark:bg-racing-900 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold">
              <UserPlus size={16} className="text-accent" />
              {t('itemInviteTitle')}
            </p>
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{title}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800">
            <X size={18} />
          </button>
        </div>
        <input
          autoFocus
          value={query}
          onChange={(e) => void runSearch(e.target.value)}
          placeholder={t('invitePlaceholder')}
          className="w-full min-h-11 rounded-xl border border-gray-200 bg-transparent px-3 py-2.5 text-base dark:border-racing-700"
          autoComplete="off"
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        {hits.length > 0 && (
          <div className="mt-3 flex max-h-56 flex-col gap-1 overflow-y-auto">
            {hits.map((u) => (
              <button
                key={u.id}
                type="button"
                disabled={sending === u.id}
                onClick={() => void send(u.id)}
                className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-racing-800 disabled:opacity-50"
              >
                <span className="min-w-0 truncate">
                  {u.display_name}{' '}
                  <span className="text-xs text-gray-400">@{u.username}</span>
                </span>
                <span className="flex-shrink-0 text-sm font-semibold text-accent">
                  {sending === u.id ? '…' : t('inviteSend')}
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-gray-400">{t('itemInviteHint')}</p>
      </div>
    </div>
  )
}
