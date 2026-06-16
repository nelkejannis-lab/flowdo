import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { Eye, EyeOff, CalendarDays, CheckSquare, Clock, MessageCircle, ArrowRight, X } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { isSupabaseConfigured } from '../lib/supabase'

const FEATURES = [
  { icon: CheckSquare, label: 'Aufgaben & Projekte', sub: 'Tasks, Boards, Eisenhower', color: '#7c6bff' },
  { icon: CalendarDays, label: 'Kalender & Termine', sub: 'Events, Einladungen, Teams', color: '#22c4a0' },
  { icon: Clock, label: 'Zeiterfassung', sub: 'Überstunden, Profile, Live', color: '#f59e0b' },
  { icon: MessageCircle, label: 'Team & Chat', sub: 'Nachrichten, Kollegen', color: '#ec4899' },
]

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset)

  const [phase, setPhase] = useState<'hero' | 'auth'>('hero')
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

  function openAuth(m: 'login' | 'signup') {
    setMode(m)
    setError(null)
    setInfo(null)
    setPhase('auth')
  }

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
        if (password.length < 8) { setError(t('errors.passwordTooShort')); return }
        if (password !== confirmPassword) { setError(t('errors.passwordMismatch')); return }
        const err = await signUp(email, password, username, displayName || username, birthday || undefined)
        if (err) setError(err)
        else { setInfo(t('messages.accountCreated')); switchMode('login') }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        @keyframes mcFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes mcSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes mcGlow {
          0%, 100% { opacity: .35; transform: scale(1); }
          50%       { opacity: .55; transform: scale(1.08); }
        }
        @keyframes mcFloat {
          0%, 100% { transform: translateY(0px) rotate(-2deg); }
          50%       { transform: translateY(-12px) rotate(2deg); }
        }
        .mc-fade-up   { animation: mcFadeUp  .6s cubic-bezier(.22,1,.36,1) both; }
        .mc-slide-up  { animation: mcSlideUp .5s cubic-bezier(.32,.72,0,1)  both; }
        .mc-glow      { animation: mcGlow   4s ease-in-out infinite; }
        .mc-float     { animation: mcFloat  5s ease-in-out infinite; }
        .d1 { animation-delay: .05s; }
        .d2 { animation-delay: .15s; }
        .d3 { animation-delay: .25s; }
        .d4 { animation-delay: .35s; }
        .d5 { animation-delay: .45s; }
        .d6 { animation-delay: .55s; }
      `}</style>

      <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#09090f]">

        {/* Background glow blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="mc-glow absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[#7c6bff]/20 blur-3xl" />
          <div className="mc-glow absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-[#ec4899]/15 blur-3xl" style={{ animationDelay: '2s' }} />
          <div className="mc-glow absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#22c4a0]/10 blur-3xl" style={{ animationDelay: '1s' }} />
        </div>

        {/* Hero */}
        {phase === 'hero' && (
          <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">

            {/* Logo + wordmark */}
            <div className="mc-fade-up mb-6 flex flex-col items-center gap-3">
              <div className="mc-float">
                <img src="/logo-full.svg" alt="MoonCrew" className="h-24 w-auto drop-shadow-[0_0_24px_rgba(124,107,255,.5)]" />
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  Moon<span style={{ color: '#7c6bff' }}>Crew</span>
                </h1>
                <p className="mt-1 text-sm font-medium text-white/50 tracking-widest uppercase">Work Organizer</p>
              </div>
            </div>

            {/* Tagline */}
            <p className="mc-fade-up d1 mb-10 max-w-xs text-center text-base text-white/60 leading-relaxed">
              Alles was dein Team braucht — Aufgaben, Kalender, Zeiterfassung und Chat in einer App.
            </p>

            {/* Feature grid */}
            <div className="mc-fade-up d2 mb-10 grid grid-cols-2 gap-3 w-full max-w-xs">
              {FEATURES.map((f, i) => (
                <div
                  key={f.label}
                  className={`mc-fade-up d${i + 3} flex flex-col gap-1.5 rounded-2xl border border-white/8 bg-white/5 p-3.5 backdrop-blur-sm`}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ backgroundColor: f.color + '22' }}>
                    <f.icon size={16} style={{ color: f.color }} />
                  </div>
                  <p className="text-xs font-semibold text-white/90">{f.label}</p>
                  <p className="text-[11px] text-white/40 leading-tight">{f.sub}</p>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="mc-fade-up d6 flex w-full max-w-xs flex-col gap-3">
              <button
                onClick={() => openAuth('login')}
                className="group flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[.98]"
                style={{ background: 'linear-gradient(135deg, #7c6bff, #a855f7)' }}
              >
                Anmelden
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
              </button>
              <button
                onClick={() => openAuth('signup')}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 py-3.5 text-sm font-semibold text-white/80 backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:text-white hover:scale-[1.02] active:scale-[.98]"
              >
                Registrieren
              </button>
            </div>

            {/* Footer links */}
            <div className="mt-8 flex gap-5 text-xs text-white/25">
              <Link to="/datenschutz" className="hover:text-white/50 transition-colors">{t('footer.privacy')}</Link>
              <Link to="/impressum" className="hover:text-white/50 transition-colors">{t('footer.imprint')}</Link>
            </div>
          </div>
        )}

        {/* Auth overlay */}
        {phase === 'auth' && (
          <>
            {/* Dimmed hero bg visible behind sheet */}
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-0">
              <div className="mb-8 text-center">
                <img src="/logo-full.svg" alt="MoonCrew" className="mx-auto mb-3 h-14 w-auto opacity-60" />
                <p className="text-sm text-white/30">MoonCrew Work Organizer</p>
              </div>
            </div>

            {/* Bottom sheet */}
            <div className="mc-slide-up absolute inset-x-0 bottom-0 rounded-t-3xl bg-white px-6 pb-8 pt-5 shadow-2xl dark:bg-[#111118]">
              {/* Handle bar */}
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200 dark:bg-white/10" />

              {/* Close → back to hero */}
              <button
                onClick={() => setPhase('hero')}
                className="absolute right-5 top-5 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>

              <h2 className="mb-5 text-lg font-bold text-gray-900 dark:text-white">
                {mode === 'login' ? t('title.login') : mode === 'signup' ? t('title.signup') : t('title.forgot')}
              </h2>

              {!isSupabaseConfigured && (
                <p className="mb-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <Trans t={t} i18nKey="supabaseNotConfigured" components={{ code: <code /> }} />
                </p>
              )}

              {mode === 'forgot' && (
                <p className="mb-4 text-sm text-gray-500">{t('forgotDescription')}</p>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                {mode === 'signup' && (
                  <>
                    <input
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                      placeholder={t('fields.usernamePlaceholder')}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#7c6bff] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder={t('fields.displayNamePlaceholder')}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#7c6bff] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                    <input
                      required
                      type="date"
                      value={birthday}
                      onChange={(e) => setBirthday(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#7c6bff] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </>
                )}

                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('fields.emailPlaceholder')}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#7c6bff] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                />

                {mode !== 'forgot' && (
                  <div className="relative">
                    <input
                      required
                      type={showPassword ? 'text' : 'password'}
                      minLength={mode === 'signup' ? 8 : 1}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-sm focus:border-[#7c6bff] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                    <button type="button" onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                )}

                {mode === 'signup' && (
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={`${t('fields.confirmPassword')} ••••••••`}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:border-[#7c6bff] focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                )}

                {mode === 'login' && (
                  <button type="button" onClick={() => switchMode('forgot')}
                    className="self-end text-xs font-medium text-[#7c6bff] hover:underline">
                    {t('forgotPasswordLink')}
                  </button>
                )}

                {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
                {info  && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">{info}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[.98] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #7c6bff, #a855f7)' }}
                >
                  {loading
                    ? t('buttons.pleaseWait')
                    : mode === 'login' ? t('buttons.login')
                    : mode === 'signup' ? t('buttons.signup')
                    : t('buttons.sendLink')}
                  {!loading && <ArrowRight size={15} />}
                </button>
              </form>

              {mode === 'forgot' ? (
                <p className="mt-4 text-center text-sm text-gray-400">
                  <button onClick={() => switchMode('login')} className="font-medium text-[#7c6bff] hover:underline">
                    {t('buttons.backToLogin')}
                  </button>
                </p>
              ) : (
                <p className="mt-4 text-center text-sm text-gray-400">
                  {mode === 'login' ? t('buttons.noAccount') : t('buttons.hasAccount')}{' '}
                  <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                    className="font-medium text-[#7c6bff] hover:underline">
                    {mode === 'login' ? t('buttons.register') : t('buttons.login')}
                  </button>
                </p>
              )}

              <div className="mt-5 flex justify-center gap-5 text-xs text-gray-300 dark:text-white/20">
                <Link to="/datenschutz" className="hover:underline">{t('footer.privacy')}</Link>
                <Link to="/impressum" className="hover:underline">{t('footer.imprint')}</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
