import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Bookmark,
  Eye,
  Heart,
  Link2,
  MessageCircle,
  RefreshCw,
  Repeat2,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useSocialStore } from '../store/socialStore'
import Sparkline from '../components/social/Sparkline'
import { formatFriendlyDateTime } from '../utils/date'

function MetricCard({ label, value, trend, icon }: { label: string; value: number | string; trend?: number[]; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {trend && trend.length >= 2 && (
        <div className="mt-2">
          <Sparkline values={trend} width={180} height={40} />
        </div>
      )}
    </div>
  )
}

export default function SocialAccountDetailPage() {
  const { t } = useTranslation('social')
  const { accountId } = useParams()
  const navigate = useNavigate()
  const accounts = useSocialStore((s) => s.accounts)
  const metrics = useSocialStore((s) => s.metrics)
  const posts = useSocialStore((s) => s.posts)
  const stories = useSocialStore((s) => s.stories)
  const fetchAccounts = useSocialStore((s) => s.fetchAccounts)
  const fetchAccountData = useSocialStore((s) => s.fetchAccountData)
  const syncAccount = useSocialStore((s) => s.syncAccount)
  const updateAccessToken = useSocialStore((s) => s.updateAccessToken)
  const deleteAccount = useSocialStore((s) => s.deleteAccount)
  const syncingId = useSocialStore((s) => s.syncingId)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [savingToken, setSavingToken] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)

  const account = accounts.find((a) => a.id === accountId)

  useEffect(() => {
    if (accounts.length === 0) fetchAccounts()
  }, [accounts.length, fetchAccounts])

  useEffect(() => {
    if (accountId) fetchAccountData(accountId)
  }, [accountId, fetchAccountData])

  if (!account || !accountId) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center text-gray-400">
        <p>{t('detail.notFound')}</p>
        <button
          onClick={() => navigate('/social')}
          className="flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          <ArrowLeft size={16} />
          {t('detail.back')}
        </button>
      </div>
    )
  }

  const id = accountId
  const accountMetrics = metrics[id] ?? []
  const latest = accountMetrics[accountMetrics.length - 1]
  const accountPosts = posts[id] ?? []
  const accountStories = stories[id] ?? []

  async function handleSync() {
    setSyncError(null)
    const err = await syncAccount(id)
    if (err) setSyncError(err)
  }

  async function handleDelete() {
    await deleteAccount(id)
    navigate('/social')
  }

  async function handleSaveToken(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenInput.trim()) return
    setSavingToken(true)
    setTokenError(null)
    const err = await updateAccessToken(id, tokenInput.trim())
    setSavingToken(false)
    if (err) {
      setTokenError(err)
      return
    }
    setTokenInput('')
  }

  return (
    <div>
      <button
        onClick={() => navigate('/social')}
        className="mb-3 flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        {t('detail.backToSocial')}
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {account.profilePictureUrl && (
            <img src={account.profilePictureUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          )}
          <div>
            <h1 className="text-2xl font-semibold">@{account.username}</h1>
            {account.name && <p className="text-sm font-medium text-gray-500 dark:text-racing-200">{account.name}</p>}
            {account.biography && <p className="mt-1 max-w-md text-sm text-gray-500 dark:text-racing-200">{account.biography}</p>}
            {account.website && (
              <a
                href={account.website}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex items-center gap-1 text-sm text-accent hover:underline"
              >
                <Link2 size={12} />
                {account.website}
              </a>
            )}
            <p className="mt-1 text-sm text-gray-400">
              {account.lastSyncedAt ? t('detail.lastSynced', { date: formatFriendlyDateTime(account.lastSyncedAt) }) : t('detail.notSyncedYet')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncingId === accountId || !account.accessToken}
            title={!account.accessToken ? t('detail.accessTokenRequired') : undefined}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            <RefreshCw size={14} className={syncingId === accountId ? 'animate-spin' : ''} />
            {syncingId === accountId ? t('detail.syncing') : t('detail.syncNow')}
          </button>
          <button
            onClick={handleDelete}
            title={t('detail.removeAccount')}
            className="rounded-lg border border-gray-200 p-2 text-gray-400 hover:border-red-200 hover:text-red-500 dark:border-racing-700"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {!account.accessToken && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-4 dark:border-racing-800 dark:bg-racing-900">
          <h2 className="mb-2 text-sm font-semibold">{t('detail.addToken.heading')}</h2>
          <p className="mb-2 text-sm text-gray-400">
            {t('detail.addToken.description')}
          </p>
          <form onSubmit={handleSaveToken} className="flex flex-col gap-2 sm:flex-row">
            <textarea
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              rows={2}
              placeholder={t('detail.addToken.placeholder')}
              className="flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none dark:border-racing-700"
            />
            <button
              type="submit"
              disabled={savingToken || !tokenInput.trim()}
              className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
            >
              {savingToken ? t('detail.addToken.saving') : t('detail.addToken.save')}
            </button>
          </form>
          {tokenError && <p className="mt-2 text-sm text-red-500">{tokenError}</p>}
        </div>
      )}

      {syncError && <p className="mb-3 text-sm text-red-500">{syncError}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={t('detail.metrics.followers')}
          value={latest?.followersCount ?? '–'}
          icon={<Users size={12} />}
          trend={accountMetrics.map((m) => m.followersCount ?? 0)}
        />
        <MetricCard
          label={t('detail.metrics.reach')}
          value={latest?.reach ?? '–'}
          icon={<TrendingUp size={12} />}
          trend={accountMetrics.map((m) => m.reach ?? 0)}
        />
        <MetricCard
          label={t('detail.metrics.profileViews')}
          value={latest?.profileViews ?? '–'}
          icon={<Eye size={12} />}
          trend={accountMetrics.map((m) => m.profileViews ?? 0)}
        />
        <MetricCard
          label={t('detail.metrics.interactions')}
          value={latest?.totalInteractions ?? '–'}
          icon={<Heart size={12} />}
          trend={accountMetrics.map((m) => m.totalInteractions ?? 0)}
        />
        <MetricCard
          label={t('detail.metrics.likes')}
          value={latest?.likes ?? '–'}
          icon={<Heart size={12} />}
          trend={accountMetrics.map((m) => m.likes ?? 0)}
        />
        <MetricCard
          label={t('detail.metrics.comments')}
          value={latest?.comments ?? '–'}
          icon={<MessageCircle size={12} />}
          trend={accountMetrics.map((m) => m.comments ?? 0)}
        />
        <MetricCard
          label={t('detail.metrics.shares')}
          value={latest?.shares ?? '–'}
          icon={<Repeat2 size={12} />}
          trend={accountMetrics.map((m) => m.shares ?? 0)}
        />
        <MetricCard
          label={t('detail.metrics.saves')}
          value={latest?.saves ?? '–'}
          icon={<Bookmark size={12} />}
          trend={accountMetrics.map((m) => m.saves ?? 0)}
        />
      </div>

      {accountStories.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">{t('detail.stories.heading')}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accountStories.map((story) => (
              <div key={story.id} className="rounded-xl border border-gray-100 bg-white p-3 dark:border-racing-800 dark:bg-racing-900">
                <p className="mb-2 text-xs text-gray-400">{formatFriendlyDateTime(story.postedAt)}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p>{t('detail.stories.impressions')}: <span className="font-semibold">{story.impressions ?? '–'}</span></p>
                  <p>{t('detail.stories.reach')}: <span className="font-semibold">{story.reach ?? '–'}</span></p>
                  <p>{t('detail.stories.replies')}: <span className="font-semibold">{story.replies ?? '–'}</span></p>
                  <p>{t('detail.stories.exits')}: <span className="font-semibold">{story.exits ?? '–'}</span></p>
                  <p>{t('detail.stories.tapsForward')}: <span className="font-semibold">{story.tapsForward ?? '–'}</span></p>
                  <p>{t('detail.stories.tapsBack')}: <span className="font-semibold">{story.tapsBack ?? '–'}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">{t('detail.posts.heading')}</h2>
        {accountPosts.length === 0 ? (
          <p className="text-sm text-gray-400">{t('detail.posts.empty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accountPosts.map((post) => (
              <a
                key={post.id}
                href={post.permalink}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-white p-3 transition-shadow hover:shadow-md dark:border-racing-800 dark:bg-racing-900"
              >
                {(post.thumbnailUrl || post.mediaUrl) && post.mediaType !== 'VIDEO' && (
                  <img src={post.thumbnailUrl ?? post.mediaUrl} alt="" className="aspect-square w-full rounded-lg object-cover" />
                )}
                {post.caption && <p className="line-clamp-2 text-sm text-gray-500 dark:text-racing-200">{post.caption}</p>}
                <p className="text-xs text-gray-400">{formatFriendlyDateTime(post.postedAt)}</p>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-racing-200">
                  <span className="flex items-center gap-1"><Heart size={12} /> {post.likeCount ?? 0}</span>
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {post.commentsCount ?? 0}</span>
                  {post.reach !== undefined && <span className="flex items-center gap-1"><TrendingUp size={12} /> {post.reach}</span>}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
