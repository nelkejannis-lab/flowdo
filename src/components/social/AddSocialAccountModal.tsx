import { useState } from 'react'
import Modal from '../layout/Modal'
import { useSocialStore } from '../../store/socialStore'

export default function AddSocialAccountModal({ onClose }: { onClose: () => void }) {
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
    <Modal title="Instagram-Account verbinden" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Instagram-Benutzername</label>
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="z. B. meinmarkenaccount"
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Instagram User ID</label>
          <input
            value={igUserId}
            onChange={(e) => setIgUserId(e.target.value)}
            placeholder="z. B. 17841400000000000"
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Access Token (optional)</label>
          <textarea
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            rows={3}
            placeholder="Langlebiger Access Token aus dem Meta Developer Portal – kann auch später ergänzt werden"
            className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-mono focus:border-accent focus:outline-none dark:border-racing-700"
          />
          <p className="mt-1 text-xs text-gray-400">
            Ohne Token kann der Account angelegt, aber nicht synchronisiert werden. Du kannst den Token jederzeit auf der Account-Seite nachtragen.
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500 dark:bg-racing-800 dark:text-racing-200">
          <p className="mb-1 font-medium text-gray-600 dark:text-racing-100">So findest du diese Daten:</p>
          <ol className="list-decimal space-y-1 pl-4">
            <li>Erstelle eine App im Meta Developer Portal und füge das Produkt „Instagram Graph API" hinzu.</li>
            <li>Verknüpfe deinen Instagram-Account (Business/Creator) mit einer Facebook-Seite.</li>
            <li>Erzeuge im Graph API Explorer einen Access Token mit den Berechtigungen
              <code className="mx-1 rounded bg-white px-1 dark:bg-racing-900">instagram_basic</code>,
              <code className="mx-1 rounded bg-white px-1 dark:bg-racing-900">instagram_manage_insights</code>,
              <code className="mx-1 rounded bg-white px-1 dark:bg-racing-900">pages_show_list</code>.
            </li>
            <li>Wandle ihn in einen langlebigen Token um (60 Tage gültig).</li>
            <li>Die Instagram User ID erhältst du über <code className="rounded bg-white px-1 dark:bg-racing-900">/me/accounts</code> → Seite → <code className="rounded bg-white px-1 dark:bg-racing-900">instagram_business_account</code>.</li>
          </ol>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {saving ? 'Speichere…' : 'Verbinden'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
