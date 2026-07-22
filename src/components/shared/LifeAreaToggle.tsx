import { useTranslation } from 'react-i18next'
import type { LifeArea } from '../../lib/lifeArea'

interface LifeAreaToggleProps {
  value: LifeArea
  onChange: (value: LifeArea) => void
  className?: string
}

export default function LifeAreaToggle({ value, onChange, className = '' }: LifeAreaToggleProps) {
  const { t } = useTranslation('common')

  return (
    <div className={`flex rounded-xl border border-gray-200 p-0.5 dark:border-racing-700 ${className}`}>
      {(['private', 'work'] as const).map((area) => (
        <button
          key={area}
          type="button"
          onClick={() => onChange(area)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
            value === area
              ? area === 'work'
                ? 'bg-accent text-white shadow-sm'
                : 'bg-violet-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-800 dark:text-racing-300 dark:hover:text-white'
          }`}
        >
          {t(`lifeArea.${area}`)}
        </button>
      ))}
    </div>
  )
}
