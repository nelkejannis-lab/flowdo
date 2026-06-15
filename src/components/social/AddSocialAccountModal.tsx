import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../layout/Modal'
import { useSocialStore } from '../../store/socialStore'

export default function AddSocialAccountModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('social')
  const addAccount = useSocialStore((s) => s.addAccount)

  const [username, setUsername] = useState('')
  const [igUserId, setIgUserId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !igUserId.trim()) return

    setSaving(true)
    setError(null)
    const err = await addAccount({
      username: username.trim(),
      igUserId: igUserId.trim(),
      accessToken: accessToken.trim() || undefined,
    })
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    onClose()
  }

  return (
    <Modal title={t('addModal.title')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('addModal.usernameLabel')}</label>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t('addModal.usernamePlaceholder')}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('addModal.igUserIdLabel')}</label>
          <input
            value={igUserId}
            onChange={(e) => setIgUserId(e.target.value)}
            placeholder={t('addModal.igUserIdPlaceholder')}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">{t('addModal.accessTokenLabel')}</label>
          <textarea
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            rows={3}
            placeholder={t('addModal.accessTokenPlaceholder')}
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none dark:border-racing-700"
          />
          <p className="mt-1 text-xs text-gray-400">
            {t('addModal.accessTokenHint')}
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-racing-800 dark:text-racing-200">
          <p className="mb-1 font-medium text-gray-600 dark:text-racing-100">{t('addModal.instructions.heading')}</p>
          <ol className="list-decimal space-y-1 break-words pl-4">
            <li>{t('addModal.instructions.step1')}</li>
            <li>{t('addModal.instructions.step2')}</li>
            <li>{t('addModal.instructions.step3')}
              <code className="mx-1 rounded bg-white px-1 dark:bg-racing-900">instagram_basic</code>,
              <code className="mx-1 rounded bg-white px-1 dark:bg-racing-900">instagram_manage_insights</code>,
              <code className="mx-1 rounded bg-white px-1 dark:bg-racing-900">pages_show_list</code>.
            </li>
            <li>{t('addModal.instructions.step4')}</li>
            <li>{t('addModal.instructions.step5Pre')} <code className="rounded bg-white px-1 dark:bg-racing-900">/me/accounts</code> {t('addModal.instructions.step5Mid')} <code className="rounded bg-white px-1 dark:bg-racing-900">instagram_business_account</code>.</li>
          </ol>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {saving ? t('addModal.connecting') : t('addModal.connect')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
