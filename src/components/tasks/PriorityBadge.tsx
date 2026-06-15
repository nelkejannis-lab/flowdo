import { useTranslation } from 'react-i18next'
import type { Priority } from '../../types'

const styles: Record<Priority, string> = {
  high: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  low: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
}

const labelKeys: Record<Priority, string> = {
  high: 'priority.high',
  medium: 'priority.medium',
  low: 'priority.low',
}

export default function PriorityBadge({ priority }: { priority: Priority }) {
  const { t } = useTranslation('tasks')
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[priority]}`}>
      {t(labelKeys[priority])}
    </span>
  )
}
