import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import { Eye, EyeOff, CalendarDays, CheckSquare, Clock, MessageCircle, ArrowRight, ChevronLeft } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { isSupabaseConfigured } from '../lib/supabase'

const FEATURES = [
  { icon: CheckSquare,  label: 'Tasks & Projects',  sub: 'Lists · Boards · Eisenhower' },
  { icon: CalendarDays, label: 'Calendar & Events', sub: 'Events · Invites · Teams'    },
  { icon: Clock,        label: 'Time Tracking',     sub: 'Overtime · Profiles · Live'  },
  { icon: MessageCircle,label: 'Team & Chat',       sub: 'Messages · Colleagues'       },
]

/* ─── shared input style ─── */
const inp = 'w-full rounded-xl border border-white/[.1] bg-white/[.05] px-3.5 py-2.5 text-[13.5px] text-white placeholder:text-white/25 transition-all duration-150 focus:border-white/30 focus:bg-white/[.09] focus:outline-none'

export default function LoginPage() {
  const { t } = useTranslation('auth')
  const signIn              = useAuthStore((s) => s.signIn)
  const signUp              = useAuthStore((s) => s.signUp)
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset)

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
        const err = await signUp(email, pw, uname, dname || uname, bday || undefined)
        err ? setError(err) : (setInfo(t('messages.accountCreated')), switchMode('login'))
      }
    } finally { setBusy(false) }
  }

  /* ─── auth form (shared desktop + mobile) ─── */
  const AuthForm = (
    <div className="flex w-full flex-col">
      {/* mode tabs */}
      <div className="mb-6 flex rounded-xl bg-white/[.07] p-1">
        {(['login', 'signup'] as const).map((m) => (
          <button key={m} type="button" onClick={() => switchMode(m)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-200 ${
              mode === m ? 'bg-white/[.13] text-white shadow-sm' : 'text-white/40 hover:text-white/70'
            }`}>
            {m === 'login' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      {mode === 'forgot' && (
        <p className="mb-4 text-[13px] text-white/50 leading-relaxed">{t('forgotDescription')}</p>
      )}

      {!isSupabaseConfigured && (
        <p className="mb-4 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-300">
          <Trans t={t} i18nKey="supabaseNotConfigured" components={{ code: <code className="font-mono" /> }} />
        </p>
      )}

      <form onSubmit={submit} className="flex flex-col gap-2.5">
        {mode === 'signup' && (<>
          <input required value={uname} onChange={(e) => setUname(e.target.value.toLowerCase().replace(/\s+/g,''))}
            placeholder={t('fields.usernamePlaceholder')} className={inp} />
          <input value={dname} onChange={(e) => setDname(e.target.value)}
            placeholder={t('fields.displayNamePlaceholder')} className={inp} />
          {/* Birthday — custom selects to avoid ugly native date picker */}
          <div className="grid grid-cols-3 gap-2">
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
                className="w-full rounded-xl border border-white/[.1] bg-white/[.05] px-2.5 py-2.5 text-[13px] text-white appearance-none focus:border-white/25 focus:bg-white/[.09] focus:outline-none [color-scheme:dark]"
              >
                <option value="" disabled className="bg-[#1a1730] text-white/40">{sel.label}</option>
                {sel.options.map((o) => typeof o === 'string'
                  ? <option key={o} value={o} className="bg-[#1a1730]">{o}</option>
                  : <option key={o.v} value={o.v} className="bg-[#1a1730]">{o.l}</option>
                )}
              </select>
            ))}
          </div>
        </>)}

        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder={t('fields.emailPlaceholder')} className={inp} />

        {mode !== 'forgot' && (
          <div className="relative">
            <input required type={showPw ? 'text' : 'password'} minLength={mode === 'signup' ? 8 : 1}
              value={pw} onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••" className={inp + ' pr-10'} />
            <button type="button" onClick={() => setShowPw(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
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
            className="self-end text-[12px] font-medium text-white/60 hover:text-white transition-colors">
            {t('forgotPasswordLink')}
          </button>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5">
            <span className="mt-px text-red-400 text-[13px] leading-relaxed">{error}</span>
          </div>
        )}
        {info && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
            <span className="mt-px text-emerald-400 text-[13px] leading-relaxed">{info}</span>
          </div>
        )}

        <button type="submit" disabled={busy}
          className="btn-glow mt-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13.5px] font-semibold text-white transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
          style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
          {busy
            ? <span className="flex items-center gap-2"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />{t('buttons.pleaseWait')}</span>
            : <>{mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : t('buttons.sendLink')}<ArrowRight size={14} /></>
          }
        </button>
      </form>

      {mode === 'forgot' ? (
        <button onClick={() => switchMode('login')}
          className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-white/40 hover:text-white/70 transition-colors">
          <ChevronLeft size={13} />{t('buttons.backToLogin')}
        </button>
      ) : (
        <p className="mt-5 text-center text-[12px] text-white/30">
          {mode === 'login' ? t('buttons.noAccount') : t('buttons.hasAccount')}{' '}
          <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
            className="font-semibold text-white/60 hover:text-white transition-colors">
            {mode === 'login' ? t('buttons.register') : t('buttons.login')}
          </button>
        </p>
      )}
    </div>
  )

  return (
    <>
      <style>{`
        @keyframes mcUp   { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:translateY(0) } }
        @keyframes mcGlow { 0%,100% { opacity:.3; transform:scale(1) } 50% { opacity:.5; transform:scale(1.1) } }
        @keyframes mcFloat{ 0%,100% { transform:translateY(0) rotate(-1.5deg) } 50% { transform:translateY(-14px) rotate(1.5deg) } }
        @keyframes sheetUp{ from { transform:translateY(100%); opacity:0 } to { transform:translateY(0); opacity:1 } }
        @keyframes cardIn { from { opacity:0; transform:translateY(16px) scale(.97) } to { opacity:1; transform:translateY(0) scale(1) } }
        .mc-up    { animation: mcUp   .65s cubic-bezier(.22,1,.36,1) both }
        .mc-glow  { animation: mcGlow 5s ease-in-out infinite }
        .mc-float { animation: mcFloat 6s ease-in-out infinite }
        .sheet-up { animation: sheetUp .46s cubic-bezier(.32,.72,0,1) both }
        .card-in  { animation: cardIn  .5s cubic-bezier(.22,1,.36,1) both }
        .d1{animation-delay:.06s}.d2{animation-delay:.14s}.d3{animation-delay:.22s}
        .d4{animation-delay:.30s}.d5{animation-delay:.38s}.d6{animation-delay:.46s}

        /* noise grain overlay */
        .mc-grain::after {
          content:''; position:absolute; inset:0; pointer-events:none; z-index:1;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.04'/%3E%3C/svg%3E");
          background-size:180px; opacity:.35;
        }

        /* glass card */
        .glass {
          background: linear-gradient(145deg, rgba(255,255,255,.09) 0%, rgba(255,255,255,.04) 100%);
          backdrop-filter: blur(28px) saturate(160%);
          -webkit-backdrop-filter: blur(28px) saturate(160%);
          border: 1px solid rgba(255,255,255,.11);
          box-shadow: 0 32px 64px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04) inset;
        }
        /* feature card hover */
        .feat-card {
          transition: transform .22s cubic-bezier(.22,1,.36,1), background .22s, border-color .22s, box-shadow .22s;
        }
        .feat-card:hover {
          transform: translateY(-3px) scale(1.02);
          background: rgba(255,255,255,.07);
          border-color: rgba(255,255,255,.16);
          box-shadow: 0 8px 32px rgba(0,0,0,.4);
        }
        /* submit btn */
        .btn-glow { transition: transform .18s ease, box-shadow .18s ease; }
        .btn-glow:hover {
          box-shadow: 0 0 0 1px rgba(255,255,255,.15), 0 8px 24px rgba(0,0,0,.4);
          transform: translateY(-1px);
        }
        .btn-glow:active { transform: translateY(0) scale(.98); }
        /* mobile bottom sheet */
        .glass-sheet {
          background: linear-gradient(180deg, rgba(16,16,16,.98) 0%, rgba(10,10,10,1) 100%);
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border-top: 1px solid rgba(255,255,255,.1);
          box-shadow: 0 -24px 64px rgba(0,0,0,.6);
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════
          ROOT — dark starfield bg
      ══════════════════════════════════════════════════════════ */}
      <div className="mc-grain relative min-h-screen overflow-hidden bg-[#0a0a0a]" style={{ backgroundColor: '#0a0a0a' }}>

        {/* Ambient — subtle white radials only, no color */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="mc-glow absolute -left-48 -top-48 h-[640px] w-[640px] rounded-full bg-white/[.025] blur-[120px]" />
          <div className="mc-glow absolute -right-32 top-[25%] h-[480px] w-[480px] rounded-full bg-white/[.018] blur-[100px]" style={{animationDelay:'2.5s'}} />
          <div className="mc-glow absolute bottom-[-8%] left-[30%] h-[400px] w-[400px] rounded-full bg-white/[.015] blur-[90px]" style={{animationDelay:'1.2s'}} />
        </div>

        {/* ── DESKTOP layout (md+) ── */}
        <div className="relative z-10 hidden min-h-screen md:flex items-center justify-center px-8 lg:px-16">
          <div className="flex w-full max-w-5xl items-center gap-12 lg:gap-20">

          {/* Left — hero */}
          <div className="flex flex-1 flex-col items-start">

            {/* Logo */}
            <div className="mc-up mb-8 flex flex-col gap-4">
              <div className="mc-float">
                <img src="/logo-full.svg" alt="MoonCrew"
                  className="h-14 w-auto drop-shadow-[0_0_32px_rgba(139,92,246,.6)]" />
              </div>
              <div>
                <h1 className="text-4xl font-bold tracking-[-0.03em] text-white lg:text-5xl">
                  Moon<span className="text-white/55">Crew</span>
                </h1>
                <p className="mt-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white/25">
                  Work Organizer
                </p>
              </div>
            </div>

            {/* Tagline */}
            <p className="mc-up d1 mb-8 max-w-xs text-[14.5px] leading-relaxed text-white/45">
              Everything your team needs — tasks, calendar, time tracking and chat in one app.
            </p>

            {/* Features */}
            <div className="mc-up d2 grid grid-cols-2 gap-2.5 w-full max-w-[360px]">
              {FEATURES.map((f, i) => (
                <div key={f.label}
                  className={`feat-card mc-up d${i+3} flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] px-3.5 py-3 backdrop-blur-sm cursor-default`}>
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[.07]">
                    <f.icon size={14} className="text-white/60" />
                  </div>
                  <div>
                    <p className="text-[11.5px] font-semibold text-white/80 leading-tight">{f.label}</p>
                    <p className="text-[10px] text-white/30 leading-tight mt-0.5">{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mc-up d6 mt-10 flex gap-5 text-[11px] text-white/20">
              <Link to="/datenschutz" className="hover:text-white/50 transition-colors">{t('footer.privacy')}</Link>
              <Link to="/impressum"   className="hover:text-white/50 transition-colors">{t('footer.imprint')}</Link>
            </div>
          </div>

          {/* Right — auth glass card */}
          <div className="w-[380px] flex-shrink-0 lg:w-[400px]">
            <div className="card-in glass w-full rounded-3xl p-7" style={{ background: 'rgba(18,18,18,0.85)', backdropFilter: 'blur(28px) saturate(160%)', WebkitBackdropFilter: 'blur(28px) saturate(160%)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
              <div className="mb-6 flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[.08]">
                  <img src="/logo-full.svg" alt="" className="h-5 w-auto" />
                </div>
                <span className="text-[13px] font-semibold text-white/60">MoonCrew</span>
              </div>
              {AuthForm}
            </div>
          </div>
          </div>{/* /max-w-5xl */}
        </div>

        {/* ── MOBILE layout (< md) ── */}
        <div className="relative z-10 flex min-h-screen flex-col md:hidden">

          {/* Hero phase */}
          {phase === 'hero' && (
            <div className="flex flex-1 flex-col items-center justify-between px-6 py-14">

              {/* top: logo + tagline */}
              <div className="flex flex-col items-center text-center">
                <div className="mc-up mc-float mb-5">
                  <img src="/logo-full.svg" alt="MoonCrew"
                    className="h-20 w-auto drop-shadow-[0_0_28px_rgba(139,92,246,.55)]" />
                </div>
                <h1 className="mc-up d1 text-[28px] font-bold tracking-[-0.02em] text-white">
                  Moon<span className="text-white/55">Crew</span>
                </h1>
                <p className="mc-up d2 mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/30">
                  Work Organizer
                </p>
                <p className="mc-up d3 mt-4 max-w-[260px] text-[13.5px] leading-relaxed text-white/45">
                  Everything your team needs in one app.
                </p>
              </div>

              {/* middle: feature pills */}
              <div className="mc-up d4 my-8 grid w-full grid-cols-2 gap-2.5">
                {FEATURES.map((f) => (
                  <div key={f.label}
                    className="feat-card flex items-center gap-2.5 rounded-2xl border border-white/[.07] bg-white/[.04] px-3.5 py-3 backdrop-blur-sm cursor-default">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-white/[.07]">
                      <f.icon size={13} className="text-white/60" />
                    </div>
                    <div>
                      <p className="text-[11.5px] font-semibold text-white/80">{f.label}</p>
                      <p className="text-[10px] text-white/30">{f.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTAs */}
              <div className="mc-up d5 w-full space-y-2.5">
                <button onClick={() => open('login')}
                  className="group flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[13.5px] font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[.98]"
                  style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)' }}>
                  Sign in
                  <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
                <button onClick={() => open('signup')}
                  className="w-full rounded-2xl border border-white/[.13] py-3 text-[13.5px] font-semibold text-white/70 backdrop-blur-sm transition-all duration-200 hover:border-white/25 hover:text-white active:scale-[.98]">
                  Create account
                </button>
                <div className="flex justify-center gap-4 pt-2 text-[11px] text-white/20">
                  <Link to="/datenschutz" className="hover:text-white/40 transition-colors">{t('footer.privacy')}</Link>
                  <Link to="/impressum"   className="hover:text-white/40 transition-colors">{t('footer.imprint')}</Link>
                </div>
              </div>
            </div>
          )}

          {/* Auth phase — bottom sheet */}
          {phase === 'auth' && (
            <>
              {/* background: logo + branding visible above sheet */}
              <div className="flex flex-1 flex-col items-center justify-center">
                <div className="mc-float">
                  <img src="/logo-full.svg" alt="MoonCrew" className="h-14 w-auto opacity-50" />
                </div>
                <p className="mt-3 text-[12px] font-medium uppercase tracking-widest text-white/20">MoonCrew</p>
              </div>

              {/* the sheet */}
              <div className="sheet-up glass-sheet relative rounded-t-[2rem] px-6 pb-10 pt-5" style={{ background: 'rgba(13,13,13,0.97)', borderTop: '1px solid rgba(255,255,255,0.09)' }}>
                {/* drag handle */}
                <div className="mx-auto mb-5 h-[3px] w-9 rounded-full bg-white/[.12]" />

                {/* back button */}
                <button onClick={() => setPhase('hero')}
                  className="absolute left-5 top-5 flex items-center gap-1 text-[12px] text-white/35 hover:text-white/65 transition-colors">
                  <ChevronLeft size={14} />Back
                </button>

                {AuthForm}

                <div className="mt-5 flex justify-center gap-5 text-[11px] text-white/15">
                  <Link to="/datenschutz" className="hover:text-white/40 transition-colors">{t('footer.privacy')}</Link>
                  <Link to="/impressum"   className="hover:text-white/40 transition-colors">{t('footer.imprint')}</Link>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
