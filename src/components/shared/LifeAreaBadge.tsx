import { useTranslation } from 'react-i18next'
import type { LifeArea } from '../../lib/lifeArea'

export default function LifeAreaBadge({ area }: { area: LifeArea }) {
  const { t } = useTranslation('common')
  const isPrivate = area === 'private'

  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isPrivate
          ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300'
          : 'bg-accent/10 text-accent'
      }`}
    >
      {t(`lifeArea.${area}`)}
    </span>
  )
}
