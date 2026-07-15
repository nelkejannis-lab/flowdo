import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Building2, Loader2, CheckCircle2 } from 'lucide-react'
import { useOrgJoinStore } from '../store/orgJoinStore'
import { useOrganizationStore } from '../store/organizationStore'
import { useAuthStore } from '../store/authStore'
import { isSupabaseConfigured } from '../lib/supabase'

export default function JoinOrgPage() {
  const { t } = useTranslation('admin')
  const { token } = useParams()
  const navigate = useNavigate()
  const joinWithToken = useOrgJoinStore((s) => s.joinWithToken)
  const fetchOrg = useOrganizationStore((s) => s.fetch)
  const session = useAuthStore((s) => s.session)
  const [status, setStatus] = useState<'idle' | 'joining' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !session || !isSupabaseConfigured) return
    setStatus('joining')
    void joinWithToken(token).then(async (err) => {
      if (err) {
        setError(err)
        setStatus('error')
        return
      }
      await fetchOrg()
      setStatus('done')
      setTimeout(() => navigate('/admin'), 2000)
    })
  }, [token, session, joinWithToken, fetchOrg, navigate])

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-gray-500">
        {t('join.cloudRequired')}
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <Building2 size={40} className="text-accent" />
        <h1 className="text-xl font-semibold">{t('join.title')}</h1>
        <p className="max-w-sm text-center text-sm text-gray-500">{t('join.signInFirst')}</p>
        <Link to="/" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          {t('join.goToLogin')}
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <Building2 size={40} className="text-accent" />
      <h1 className="text-xl font-semibold">{t('join.title')}</h1>
      {status === 'joining' && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 size={16} className="animate-spin" /> {t('join.joining')}
        </p>
      )}
      {status === 'done' && (
        <p className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle2 size={16} /> {t('join.success')}
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-red-500">{error ?? t('join.failed')}</p>
      )}
    </div>
  )
}
