import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Instagram, Plus, RefreshCw, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSocialStore } from '../store/socialStore'
import AddSocialAccountModal from '../components/social/AddSocialAccountModal'
import { formatFriendlyDateTime } from '../utils/date'

export default function SocialMediaPage() {
  const { t } = useTranslation('social')
  const accounts = useSocialStore((s) => s.accounts)
  const metrics = useSocialStore((s) => s.metrics)
  const fetchAccounts = useSocialStore((s) => s.fetchAccounts)
  const fetchAccountData = useSocialStore((s) => s.fetchAccountData)
  const syncAccount = useSocialStore((s) => s.syncAccount)
  const syncingId = useSocialStore((s) => s.syncingId)
  const error = useSocialStore((s) => s.error)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  useEffect(() => {
    accounts.forEach((a) => fetchAccountData(a.id))
  }, [accounts, fetchAccountData])

  async function handleSync(accountId: string) {
    setSyncError(null)
    const err = await syncAccount(accountId)
    if (err) setSyncError(err)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('page.title')}</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
        >
          <Plus size={16} />
          {t('page.addAccount')}
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
      {syncError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400">
          <p className="font-semibold">Sync fehlgeschlagen:</p>
          <p className="mt-1">{syncError}</p>
          {syncError.includes('token') || syncError.includes('Token') || syncError.includes('OAuth') ? (
            <p className="mt-2 text-xs opacity-80">
              Tipp: Access Tokens laufen nach 60 Tagen ab. Erstelle einen neuen Long-Lived Token im Meta Graph API Explorer und aktualisiere ihn über "Token aktualisieren".
            </p>
          ) : null}
        </div>
      )}

      {accounts.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          {t('page.emptyState')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => {
            const latest = metrics[account.id]?.[metrics[account.id].length - 1]
            return (
              <Link
                key={account.id}
                to={`/social/${account.id}`}
                className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-racing-800 dark:bg-racing-900"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 text-white">
                    <Instagram size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold">@{account.username}</h3>
                    <p className="text-xs text-gray-400">
                      {account.lastSyncedAt ? t('page.lastSynced', { date: formatFriendlyDateTime(account.lastSyncedAt) }) : t('page.notSyncedYet')}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      handleSync(account.id)
                    }}
                    disabled={syncingId === account.id}
                    title={t('page.syncNow')}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-accent dark:hover:bg-racing-800 disabled:opacity-60"
                  >
                    <RefreshCw size={16} className={syncingId === account.id ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 p-2 dark:bg-racing-800">
                    <p className="flex items-center gap-1 text-xs text-gray-400">
                      <Users size={12} />
                      {t('page.stats.followers')}
                    </p>
                    <p className="text-lg font-bold">{latest?.followersCount ?? '–'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 dark:bg-racing-800">
                    <p className="text-xs text-gray-400">{t('page.stats.reachToday')}</p>
                    <p className="text-lg font-bold">{latest?.reach ?? '–'}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {showForm && <AddSocialAccountModal onClose={() => setShowForm(false)} />}
    </div>
  )
}
