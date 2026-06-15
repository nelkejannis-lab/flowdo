import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { isSupabaseConfigured } from '../lib/supabase'
import Logo from '../components/layout/Logo'

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset)

  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthday, setBirthday] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function switchMode(next: 'login' | 'signup' | 'forgot') {
    setMode(next)
    setError(null)
    setInfo(null)
    setPassword('')
    setConfirmPassword('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'forgot') {
        const err = await requestPasswordReset(email)
        if (err) setError(err)
        else setInfo(t('messages.resetSent'))
        return
      }
      if (mode === 'login') {
        const err = await signIn(email, password)
        if (err) setError(err)
      } else {
        if (password.length < 8) {
          setError(t('errors.passwordTooShort'))
          return
        }
        if (password !== confirmPassword) {
          setError(t('errors.passwordMismatch'))
          return
        }
        const err = await signUp(email, password, username, displayName || username, birthday || undefined)
        if (err) {
          setError(err)
        } else {
          setInfo(t('messages.accountCreated'))
          switchMode('login')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-racing-950">
      <div className="w-full max-w-sm rounded-xl border border-gray-100 bg-white p-6 shadow-sm dark:border-racing-800 dark:bg-racing-900">
        <div className="mb-6 flex items-center justify-center">
          <img src="/logo-full.svg" alt="MoonCrew" className="h-20 w-auto" />
        </div>

        {!isSupabaseConfigured && (
          <p className="mb-4 rounded-lg bg-amber-100 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
            <Trans
              t={t}
              i18nKey="supabaseNotConfigured"
              components={{ code: <code /> }}
            />
          </p>
        )}

        <h1 className="mb-4 text-xl font-semibold">
          {mode === 'login' ? t('title.login') : mode === 'signup' ? t('title.signup') : t('title.forgot')}
        </h1>

        {mode === 'forgot' && (
          <p className="mb-4 text-sm text-gray-500">
            {t('forgotDescription')}
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {mode === 'signup' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t('fields.username')}</label>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                  placeholder={t('fields.usernamePlaceholder')}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t('fields.displayName')}</label>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('fields.displayNamePlaceholder')}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t('fields.birthday')}</label>
                <input
                  required
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
              </div>
            </>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t('fields.email')}</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('fields.emailPlaceholder')}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
            />
          </div>

          {mode !== 'forgot' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('fields.password')}</label>
              <div className="relative">
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  minLength={mode === 'signup' ? 8 : 1}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 pr-9 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="mt-1 text-xs text-gray-400">{t('fields.passwordHint')}</p>
              )}
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">{t('fields.confirmPassword')}</label>
              <input
                required
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm focus:border-accent focus:outline-none dark:border-racing-700"
              />
            </div>
          )}

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => switchMode('forgot')}
              className="self-end text-xs font-medium text-accent hover:underline"
            >
              {t('forgotPasswordLink')}
            </button>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
          {info && <p className="text-sm text-emerald-500">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
          >
            {loading
              ? t('buttons.pleaseWait')
              : mode === 'login'
                ? t('buttons.login')
                : mode === 'signup'
                  ? t('buttons.signup')
                  : t('buttons.sendLink')}
          </button>
        </form>

        {mode === 'forgot' ? (
          <p className="mt-4 text-center text-sm text-gray-400">
            <button onClick={() => switchMode('login')} className="font-medium text-accent hover:underline">
              {t('buttons.backToLogin')}
            </button>
          </p>
        ) : (
          <p className="mt-4 text-center text-sm text-gray-400">
            {mode === 'login' ? t('buttons.noAccount') : t('buttons.hasAccount')}{' '}
            <button
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="font-medium text-accent hover:underline"
            >
              {mode === 'login' ? t('buttons.register') : t('buttons.login')}
            </button>
          </p>
        )}
      </div>
      <div className="absolute bottom-4 flex gap-4 text-xs text-gray-400">
        <Link to="/datenschutz" className="hover:underline">{t('footer.privacy')}</Link>
        <Link to="/impressum" className="hover:underline">{t('footer.imprint')}</Link>
      </div>
    </div>
  )
}
