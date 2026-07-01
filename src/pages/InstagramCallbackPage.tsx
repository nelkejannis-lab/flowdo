import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useSocialStore } from '../store/socialStore'

export default function InstagramCallbackPage() {
  const { t } = useTranslation('social')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { fetchAccounts, addAccount } = useSocialStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    const code = searchParams.get('code')?.replace(/#.*$/, '')
    const error = searchParams.get('error')
    const accountId = sessionStorage.getItem('ig_connect_account_id')

    if (error) {
      setStatus('error')
      setMessage(t('page.callback.accessDenied', { reason: searchParams.get('error_description') ?? error }))
      return
    }

    if (!code) {
      setStatus('error')
      setMessage(t('page.callback.noAuthCode'))
      return
    }

    async function exchange() {
      const res = await supabase.functions.invoke('instagram-oauth', {
        body: { code, accountId: accountId || undefined },
      })

      // Extract error message — Supabase wraps non-2xx in res.error but body has details
      if (res.error) {
        let msg = res.error.message ?? t('page.callback.connectionFailed')
        try {
          const ctx = (res.error as any).context
          if (ctx) {
            const body = typeof ctx.json === 'function' ? await ctx.json() : ctx
            if (body?.error) msg = body.error
            if (body?.debug) msg += ` | Debug: ${JSON.stringify(body.debug)}`
          }
        } catch { /* use generic message */ }
        setStatus('error')
        setMessage(msg)
        return
      }
      if (res.data?.error) {
        setStatus('error')
        setMessage(res.data.error)
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
      setMessage(t('page.callback.connectedSuccess', { username: d.username }))
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
            <p className="font-medium">{t('page.callback.connecting')}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl">✓</div>
            <p className="font-semibold text-green-700 dark:text-green-400">{message}</p>
            <p className="mt-1 text-sm text-gray-400">{t('page.callback.redirecting')}</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">✗</div>
            <p className="font-semibold text-red-700 dark:text-red-400">{t('page.callback.error')}</p>
            <p className="mt-1 text-sm text-gray-500">{message}</p>
            <button onClick={() => navigate('/social')}
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90">
              {t('page.callback.back')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
