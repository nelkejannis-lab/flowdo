import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Sparkles, CalendarDays, Clock, Trello, Settings } from 'lucide-react'
import { useSettingsStore } from '../../store/settingsStore'

const STEPS = [
  { key: 'welcome', icon: Sparkles },
  { key: 'capture', icon: Sparkles },
  { key: 'calendar', icon: CalendarDays },
  { key: 'projects', icon: Trello },
  { key: 'worktime', icon: Clock },
  { key: 'settings', icon: Settings },
] as const

export default function OnboardingWizard() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const setOnboardingTourDone = useSettingsStore((s) => s.setOnboardingTourDone)
  const [step, setStep] = useState(0)
  const current = STEPS[step]
  const Icon = current.icon
  const isLast = step === STEPS.length - 1

  function finish() {
    setOnboardingTourDone()
  }

  function next() {
    if (isLast) {
      finish()
      navigate('/einstellungen?tab=anleitung')
    } else {
      setStep((s) => s + 1)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-racing-700 dark:bg-racing-900"
      >
        <button
          type="button"
          onClick={finish}
          className="absolute right-4 top-4 rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-racing-800"
          aria-label={t('skip')}
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-accent' : 'bg-gray-200 dark:bg-racing-700'}`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="mb-6"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Icon size={24} />
            </div>
            <h2 className="text-xl font-bold">{t(`steps.${current.key}.title`)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              {t(`steps.${current.key}.desc`)}
            </p>
            {t(`steps.${current.key}.example`, { defaultValue: '' }) && (
              <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 font-mono text-xs text-gray-600 dark:bg-racing-800 dark:text-gray-300">
                {t(`steps.${current.key}.example`)}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {t('skip')}
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium dark:border-racing-700"
              >
                <ChevronLeft size={16} />
                {t('back')}
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark"
            >
              {isLast ? t('finish') : t('next')}
              {!isLast && <ChevronRight size={16} />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
