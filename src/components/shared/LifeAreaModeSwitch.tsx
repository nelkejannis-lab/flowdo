import { useTranslation } from 'react-i18next'
import { LIFE_AREA_MODES, type LifeAreaMode } from '../../lib/lifeArea'
import { useLifeAreaMode } from '../../hooks/useLifeAreaMode'

interface LifeAreaModeSwitchProps {
  className?: string
  compact?: boolean
}

export default function LifeAreaModeSwitch({ className = '', compact = false }: LifeAreaModeSwitchProps) {
  const { t } = useTranslation('common')
  const { privateAreaEnabled, mode, setLifeAreaMode } = useLifeAreaMode()

  if (!privateAreaEnabled) return null

  return (
    <div
      className={`flex rounded-xl border border-gray-200 p-0.5 dark:border-racing-700 ${className}`}
      role="group"
      aria-label={t('lifeArea.modeLabel')}
    >
      {LIFE_AREA_MODES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLifeAreaMode(option as LifeAreaMode)}
          className={`${compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'} rounded-lg font-semibold transition-colors ${
            mode === option
              ? option === 'private'
                ? 'bg-violet-500 text-white shadow-sm'
                : option === 'work'
                  ? 'bg-accent text-white shadow-sm'
                  : 'bg-gray-800 text-white shadow-sm dark:bg-racing-100 dark:text-racing-900'
              : 'text-gray-500 hover:text-gray-800 dark:text-racing-300 dark:hover:text-white'
          }`}
        >
          {t(`lifeArea.mode.${option}`)}
        </button>
      ))}
    </div>
  )
}
