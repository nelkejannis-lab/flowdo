import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { Eye, EyeOff, CalendarDays, CheckSquare, Clock, MessageCircle, ArrowRight, ChevronLeft } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { useAuthStore } from '../store/authStore'
import { isSupabaseConfigured } from '../lib/supabase'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { riseTransition, staggerContainer, staggerItem } from '../lib/motion'

const FEATURES = [
  { icon: CheckSquare,  label: 'Tasks & Projects',  sub: 'Lists · Boards · Eisenhower' },
  { icon: CalendarDays, label: 'Calendar & Events', sub: 'Events · Invites · Teams'    },
  { icon: Clock,        label: 'Time Tracking',     sub: 'Overtime · Profiles · Live'  },
  { icon: MessageCircle,label: 'Team & Chat',       sub: 'Messages · Colleagues'       },
]

/* ─── shared input style ─── */
const inp = 'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-[14px] text-white placeholder:text-white/30 backdrop-blur-md transition-all duration-300 focus:border-white/30 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-white/5'

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const language = useSettingsStore((s) => s.language)
  const setLanguage = useSettingsStore((s) => s.setLanguage)
  const signIn              = useAuthStore((s) => s.signIn)
  const signUp              = useAuthStore((s) => s.signUp)
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset)
  const reduce = useReducedMotion()

  /* mobile-only phase */
  const [phase, setPhase]   = useState<'hero' | 'auth'>('hero')
  const [mode,  setMode]    = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail]   = useState('')
  const [pw,    setPw]      = useState('')
  const [pw2,   setPw2]     = useState('')
  const [showPw,setShowPw]  = useState(false)
  const [uname, setUname]   = useState('')
  const [dname, setDname]   = useState('')
  const [bday,  setBday]    = useState('')
  const [roleDesc, setRoleDesc] = useState('')
  const [error, setError]   = useState<string | null>(null)
  const [info,  setInfo]    = useState<string | null>(null)
  const [busy,  setBusy]    = useState(false)

  function open(m: 'login' | 'signup') { setMode(m); setError(null); setInfo(null); setPhase('auth') }

  function switchMode(next: 'login' | 'signup' | 'forgot') {
    setMode(next); setError(null); setInfo(null); setPw(''); setPw2('')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setInfo(null); setBusy(true)
    try {
      if (mode === 'forgot') {
        const err = await requestPasswordReset(email)
        err ? setError(err) : setInfo(t('messages.resetSent'))
        return
      }
      if (mode === 'login') {
        const err = await signIn(email, pw)
        if (err) setError(err)
      } else {
        if (pw.length < 8)  { setError(t('errors.passwordTooShort')); return }
        if (pw !== pw2)     { setError(t('errors.passwordMismatch'));  return }
        const err = await signUp(email, pw, uname, dname || uname, bday || undefined, roleDesc || undefined)
        err ? setError(err) : (setInfo(t('messages.accountCreated')), switchMode('login'))
      }
    } finally { setBusy(false) }
  }

  /* Safe tokens only — never filter:blur (can leave login content invisible). */
  const containerVariants = staggerContainer(reduce)
  const itemVariants = staggerItem(reduce)
  const fadeIn = reduce
    ? { initial: false as const, animate: { opacity: 1, x: 0, y: 0 } }
    : {
        initial: { opacity: 0, x: 16, y: 0 },
        animate: { opacity: 1, x: 0, y: 0 },
      }

  /* ─── auth form (shared desktop + mobile) ─── */
  const AuthForm = (
    <div className="flex w-full flex-col">
      {/* mode tabs */}
      <div className="mb-8 flex rounded-2xl bg-white/5 p-1.5 backdrop-blur-md border border-white/5">
        {(['login', 'signup'] as const).map((m) => (
          <button key={m} type="button" onClick={() => switchMode(m)}
            className={`flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-all duration-300 ${
              mode === m ? 'bg-white text-black shadow-lg scale-[1.02]' : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}>
            {m === 'login' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={fadeIn.initial}
          animate={fadeIn.animate}
          exit={reduce ? undefined : { opacity: 0, x: -12 }}
          transition={riseTransition(reduce)}
        >
          {mode === 'forgot' && (
            <p className="mb-6 text-[14px] text-white/50 leading-relaxed">{t('forgotDescription')}</p>
          )}

          {!isSupabaseConfigured && (
            <p className="mb-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-[13px] text-amber-300 backdrop-blur-md">
              <Trans t={t} i18nKey="supabaseNotConfigured" components={{ code: <code className="font-mono bg-amber-500/20 px-1 rounded" /> }} />
            </p>
          )}

          <form onSubmit={submit} className="flex flex-col gap-3.5">
            {mode === 'signup' && (<>
              <input required value={uname} onChange={(e) => setUname(e.target.value.toLowerCase().replace(/\s+/g,''))}
                placeholder={t('fields.usernamePlaceholder')} className={inp} />
              <input value={dname} onChange={(e) => setDname(e.target.value)}
                placeholder={t('fields.displayNamePlaceholder')} className={inp} />
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Day', name: 'day', options: Array.from({length:31},(_,i)=>String(i+1).padStart(2,'0')) },
                  { label: 'Month', name: 'month', options: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i)=>({ v: String(i+1).padStart(2,'0'), l: m })) },
                  { label: 'Year', name: 'year', options: Array.from({length:80},(_,i)=>String(new Date().getFullYear()-i)) },
                ].map((sel) => (
                  <select key={sel.name}
                    required
                    value={bday ? (sel.name==='day'?bday.split('-')[2] : sel.name==='month'?bday.split('-')[1] : bday.split('-')[0]) : ''}
                    onChange={(e) => {
                      const parts = (bday || '--').split('-')
                      const [y,m,d] = [parts[0]||'',parts[1]||'',parts[2]||'']
                      const next = sel.name==='year' ? `${e.target.value}-${m}-${d}` : sel.name==='month' ? `${y}-${e.target.value}-${d}` : `${y}-${m}-${e.target.value}`
                      setBday(next)
                    }}
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3.5 text-[14px] text-white appearance-none focus:border-white/30 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-white/5 [color-scheme:dark] backdrop-blur-md"
                  >
                    <option value="" disabled className="bg-[#0a0a0a] text-white/40">{sel.label}</option>
                    {sel.options.map((o) => typeof o === 'string'
                      ? <option key={o} value={o} className="bg-[#0a0a0a]">{o}</option>
                      : <option key={o.v} value={o.v} className="bg-[#0a0a0a]">{o.l}</option>
                    )}
                  </select>
                ))}
              </div>
              <input value={roleDesc} onChange={(e) => setRoleDesc(e.target.value)}
                placeholder={t('fields.roleDescriptionPlaceholder')} className={inp} />
            </>)}

            <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={t('fields.emailPlaceholder')} className={inp} />

            {mode !== 'forgot' && (
              <div className="relative">
                <input required type={showPw ? 'text' : 'password'} minLength={mode === 'signup' ? 8 : 1}
                  value={pw} onChange={(e) => setPw(e.target.value)}
                  placeholder="••••••••" className={inp + ' pr-12'} />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/80 transition-colors">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            {mode === 'signup' && (
              <input required type={showPw ? 'text' : 'password'} minLength={8}
                value={pw2} onChange={(e) => setPw2(e.target.value)}
                placeholder={`${t('fields.confirmPassword')} ••••••••`} className={inp} />
            )}

            {mode === 'login' && (
              <button type="button" onClick={() => switchMode('forgot')}
                className="self-end text-[13px] font-medium text-white/40 hover:text-white transition-colors mt-1">
                {t('forgotPasswordLink')}
              </button>
            )}

            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3.5 backdrop-blur-md mt-2">
                    <span className="text-red-400 text-[13px] leading-relaxed">{error}</span>
                  </div>
                </motion.div>
              )}
              {info && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3.5 backdrop-blur-md mt-2">
                    <span className="text-emerald-400 text-[13px] leading-relaxed">{info}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button 
              type="submit" 
              disabled={busy}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-[14.5px] font-bold text-black shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all duration-300 hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] disabled:opacity-50 disabled:pointer-events-none"
            >
              {busy
                ? <span className="flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />{t('buttons.pleaseWait')}</span>
                : <>{mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : t('buttons.sendLink')}<ArrowRight size={16} /></>
              }
            </motion.button>
          </form>

          {mode === 'forgot' ? (
            <button onClick={() => switchMode('login')}
              className="mt-6 flex w-full justify-center items-center gap-1.5 text-[13px] text-white/40 hover:text-white transition-colors">
              <ChevronLeft size={14} />{t('buttons.backToLogin')}
            </button>
          ) : (
            <p className="mt-6 text-center text-[13px] text-white/40">
              {mode === 'login' ? t('buttons.noAccount') : t('buttons.hasAccount')}{' '}
              <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                className="font-bold text-white hover:text-white transition-colors underline decoration-white/30 underline-offset-4">
                {mode === 'login' ? t('buttons.register') : t('buttons.login')}
              </button>
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )

  return (
    <>
      {/* ══════════════════════════════════════════════════════════
          ROOT — dark elegant background
      ══════════════════════════════════════════════════════════ */}
      <div className="relative min-h-screen overflow-hidden bg-[#000000]">
        
        {/* Animated Background Mesh */}
        <div className="absolute inset-0 z-0">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.1, 0.2, 0.1] 
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-[30%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-gradient-to-br from-slate-600/25 via-slate-500/12 to-violet-500/10 blur-[120px]" 
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.5, 1],
              rotate: [0, -90, 0],
              opacity: [0.1, 0.15, 0.1] 
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-[20%] -right-[10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-bl from-slate-700/20 via-slate-500/12 to-violet-500/8 blur-[100px]" 
          />
        </div>

        <div className="absolute right-4 top-4 z-20 flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 backdrop-blur-md">
          {(['de', 'en'] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              onClick={() => setLanguage(lng)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                language === lng ? 'bg-white text-black' : 'text-white/60 hover:text-white'
              }`}
            >
              {lng === 'de' ? 'DE' : 'EN'}
            </button>
          ))}
        </div>

        {/* Noise overlay */}
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

        {/* ── DESKTOP layout (md+) ── */}
        <div className="relative z-10 hidden min-h-screen md:flex items-center justify-center px-8 lg:px-16">
          <div className="flex w-full max-w-[1100px] items-center gap-16 lg:gap-24">

          {/* Left — hero */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-1 flex-col items-start"
          >
            {/* Logo */}
            <motion.div variants={itemVariants} className="mb-10 flex flex-col gap-6">
              <motion.div 
                animate={{ y: [-5, 5, -5] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <img src="/logo-full-dark.svg" alt="NOVAT"
                  className="h-16 w-auto drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]" />
              </motion.div>
              <div>
                <h1 className="text-5xl font-extrabold tracking-tight text-white lg:text-6xl drop-shadow-xl">
                  NOVAT
                </h1>
                <p className="mt-3 text-[13px] font-bold uppercase tracking-[0.25em] text-white/30">
                  AI Project Management
                </p>
              </div>
            </motion.div>

            {/* Tagline */}
            <motion.p variants={itemVariants} className="mb-10 max-w-sm text-[16px] leading-relaxed text-white/50 font-medium">
              Everything your team needs — tasks, calendar, time tracking and chat in one beautifully designed app.
            </motion.p>

            {/* Features */}
            <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 w-full max-w-[440px]">
              {FEATURES.map((f, i) => (
                <motion.div 
                  key={f.label}
                  whileHover={{ scale: 1.03, backgroundColor: 'rgba(255,255,255,0.08)' }}
                  className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl cursor-default transition-colors duration-300 shadow-2xl"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
                    <f.icon size={18} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-white tracking-wide">{f.label}</p>
                    <p className="text-[12px] text-white/40 font-medium mt-1">{f.sub}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Footer */}
            <motion.div variants={itemVariants} className="mt-14 flex items-center gap-6 text-[12px] font-medium text-white/30">
              <Link to="/datenschutz" className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
              <Link to="/impressum"   className="hover:text-white transition-colors">{t('footer.imprint')}</Link>
              <Link to="/security"    className="hover:text-white transition-colors">{t('footer.security')}</Link>
              <span>v{__APP_VERSION__}</span>
            </motion.div>
          </motion.div>

          {/* Right — auth glass card — paint visible on first frame (login must never stay opacity:0) */}
          <motion.div 
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={riseTransition(reduce, 0.08)}
            className="w-[420px] flex-shrink-0 lg:w-[460px]"
          >
            <div className="w-full rounded-[2.5rem] p-10 bg-white/[0.02] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-3xl relative overflow-hidden">
              {/* Highlight edge */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
                <img src="/logo-mark.svg" alt="" className="h-5 w-auto" />
                </div>
                <span className="text-[15px] font-bold tracking-wide text-white/80">NOVAT</span>
              </div>
              {AuthForm}
            </div>
          </motion.div>
          </div>{/* /max-w-[1100px] */}
        </div>

        {/* ── MOBILE layout (< md) ── */}
        <div className="relative z-10 flex min-h-screen flex-col md:hidden">

          {/* Hero phase */}
          <AnimatePresence mode="wait">
            {phase === 'hero' && (
              <motion.div 
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0, y: -12 }}
                transition={riseTransition(reduce)}
                className="flex flex-1 flex-col items-center justify-between px-6 py-16"
              >
                {/* top: logo + tagline */}
                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col items-center text-center">
                  <motion.div variants={itemVariants} className="mb-6">
                    <img src="/logo-full-dark.svg" alt="NOVAT"
                      className="h-24 w-auto drop-shadow-[0_0_40px_rgba(255,255,255,0.3)]" />
                  </motion.div>
                  <motion.h1 variants={itemVariants} className="text-4xl font-extrabold tracking-tight text-white drop-shadow-lg">
                    NOVAT
                  </motion.h1>
                  <motion.p variants={itemVariants} className="mt-2 text-[12px] font-bold uppercase tracking-[0.2em] text-white/30">
                    AI Project Management
                  </motion.p>
                  <motion.p variants={itemVariants} className="mt-6 max-w-[280px] text-[15px] leading-relaxed text-white/50 font-medium">
                    Everything your team needs in one elegant app.
                  </motion.p>
                </motion.div>

                {/* middle: feature pills */}
                <motion.div 
                  variants={containerVariants} 
                  initial="hidden" 
                  animate="visible" 
                  className="my-10 grid w-full grid-cols-2 gap-3"
                >
                  {FEATURES.map((f) => (
                    <motion.div key={f.label} variants={itemVariants}
                      className="flex flex-col items-center text-center gap-2 rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-5 backdrop-blur-xl shadow-xl">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                        <f.icon size={18} className="text-white" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-white">{f.label}</p>
                        <p className="text-[11px] text-white/40 font-medium mt-1">{f.sub}</p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                {/* CTAs */}
                <motion.div 
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={riseTransition(reduce, 0.12)}
                  className="w-full space-y-3"
                >
                  <button onClick={() => open('login')}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-[15px] font-bold text-black shadow-[0_0_40px_rgba(255,255,255,0.2)] transition-all active:scale-[.98]">
                    Sign in
                    <ArrowRight size={16} />
                  </button>
                  <button onClick={() => open('signup')}
                    className="w-full rounded-2xl border border-white/10 py-4 text-[15px] font-bold text-white/70 backdrop-blur-md transition-all active:scale-[.98]">
                    Create account
                  </button>
                  <div className="flex items-center justify-center gap-6 pt-4 text-[12px] font-medium text-white/30">
                    <Link to="/datenschutz" className="hover:text-white transition-colors">{t('footer.privacy')}</Link>
                    <Link to="/impressum"   className="hover:text-white transition-colors">{t('footer.imprint')}</Link>
                    <Link to="/security"    className="hover:text-white transition-colors">{t('footer.security')}</Link>
                    <span>v{__APP_VERSION__}</span>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* Auth phase — bottom sheet */}
            {phase === 'auth' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 z-20 flex flex-col justify-end bg-black/40 backdrop-blur-sm"
              >
                <div className="flex-1" onClick={() => setPhase('hero')} />
                <motion.div 
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ type: 'spring' as const, damping: 25, stiffness: 200 }}
                  className="relative rounded-t-[2.5rem] bg-[#0a0a0a] border-t border-white/10 px-6 pb-12 pt-6 shadow-[0_-20px_60px_rgba(0,0,0,0.5)]"
                >
                  <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-white/20" />
                  {AuthForm}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  )
}
