import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Instagram, Plus, RefreshCw, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSocialStore } from '../store/socialStore'
import AddSocialAccountModal from '../components/social/AddSocialAccountModal'
import { formatFriendlyDateTime } from '../utils/date'

const IG_APP_ID = '1440630227832412'
const IG_REDIRECT_URI = 'https://mooncrew.app/instagram-callback'
const IG_SCOPES = 'instagram_business_basic,instagram_business_manage_insights,instagram_business_content_publish'

function buildInstagramOAuthUrl() {
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('client_id', IG_APP_ID)
  url.searchParams.set('redirect_uri', IG_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', IG_SCOPES)
  return url.toString()
}

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
        <div className="flex items-center gap-2">
          <a
            href={buildInstagramOAuthUrl()}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <Instagram size={16} />
            Mit Instagram verbinden
          </a>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold hover:bg-gray-50 dark:border-racing-700 dark:hover:bg-racing-800"
          >
            <Plus size={16} />
            Manuell
          </button>
        </div>
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
                <div className="flex items-center gap-3">
                  {account.profilePictureUrl
                    ? <img src={account.profilePictureUrl} alt="" className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-2 ring-pink-200" />
                    : <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-400 text-white"><Instagram size={20} /></span>
                  }
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold">@{account.username}</h3>
                    {account.name && <p className="text-xs text-gray-500 truncate">{account.name}</p>}
                    <p className="text-xs text-gray-400">
                      {account.lastSyncedAt ? formatFriendlyDateTime(account.lastSyncedAt) : 'Noch nicht synchronisiert'}
                    </p>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); handleSync(account.id) }}
                    disabled={syncingId === account.id} title="Synchronisieren"
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-accent dark:hover:bg-racing-800 disabled:opacity-60">
                    <RefreshCw size={16} className={syncingId === account.id ? 'animate-spin' : ''} />
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-lg bg-gray-50 p-2 dark:bg-racing-800 text-center">
                    <p className="text-[10px] text-gray-400">Follower</p>
                    <p className="text-sm font-bold">{latest?.followersCount != null ? (latest.followersCount >= 1000 ? (latest.followersCount/1000).toFixed(1)+'K' : latest.followersCount) : '–'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 dark:bg-racing-800 text-center">
                    <p className="text-[10px] text-gray-400">Reichweite</p>
                    <p className="text-sm font-bold">{latest?.reach ?? '–'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 dark:bg-racing-800 text-center">
                    <p className="text-[10px] text-gray-400">Likes</p>
                    <p className="text-sm font-bold">{latest?.likes ?? '–'}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-2 dark:bg-racing-800 text-center">
                    <p className="text-[10px] text-gray-400">Saves</p>
                    <p className="text-sm font-bold">{latest?.saves ?? '–'}</p>
                  </div>
                </div>
                {account.biography && (
                  <p className="text-xs text-gray-400 line-clamp-1">{account.biography}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}

      {showForm && <AddSocialAccountModal onClose={() => setShowForm(false)} />}
    </div>
  )
}
