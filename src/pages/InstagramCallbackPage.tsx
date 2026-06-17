import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSocialStore } from '../store/socialStore'

export default function InstagramCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { fetchAccounts, addAccount } = useSocialStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const code = searchParams.get('code')?.replace(/#.*$/, '')
    const error = searchParams.get('error')
    const accountId = sessionStorage.getItem('ig_connect_account_id')

    if (error) {
      setStatus('error')
      setMessage(`Instagram hat den Zugriff verweigert: ${searchParams.get('error_description') ?? error}`)
      return
    }

    if (!code) {
      setStatus('error')
      setMessage('Kein Autorisierungscode erhalten.')
      return
    }

    async function exchange() {
      const res = await supabase.functions.invoke('instagram-oauth', {
        body: { code, accountId: accountId || undefined },
      })

      if (res.error || res.data?.error) {
        setStatus('error')
        setMessage(res.data?.error ?? res.error?.message ?? 'Verbindung fehlgeschlagen')
        return
      }

      const d = res.data
      sessionStorage.removeItem('ig_connect_account_id')

      if (!accountId) {
        // New account — create it
        const err = await addAccount({
          username: d.username || d.igUserId,
          igUserId: d.igUserId,
          accessToken: d.accessToken,
        })
        if (err) {
          setStatus('error')
          setMessage(err)
          return
        }
      } else {
        await fetchAccounts()
      }

      setStatus('success')
      setMessage(`@${d.username} erfolgreich verbunden!`)
      setTimeout(() => navigate('/social'), 2000)
    }

    exchange()
  }, [])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-racing-950">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl dark:bg-racing-900 text-center">
        {status === 'loading' && (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            <p className="font-medium">Instagram wird verbunden…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
            <p className="font-semibold text-green-700 dark:text-green-400">{message}</p>
            <p className="mt-1 text-sm text-gray-400">Du wirst weitergeleitet…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">✗</div>
            <p className="font-semibold text-red-700 dark:text-red-400">Fehler</p>
            <p className="mt-1 text-sm text-gray-500">{message}</p>
            <button onClick={() => navigate('/social')}
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
              Zurück
            </button>
          </>
        )}
      </div>
    </div>
  )
}
