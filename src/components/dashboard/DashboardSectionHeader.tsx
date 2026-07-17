import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export default function DashboardSectionHeader({ title, subtitle, action, className = '' }: Props) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-1.5 h-5 w-1 flex-shrink-0 rounded-full bg-accent/80" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-racing-50">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-racing-300">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
