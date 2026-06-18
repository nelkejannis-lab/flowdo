interface Props {
  badge: string | null | undefined
  size?: 'sm' | 'xs'
}

const BADGE_COLORS: Record<string, string> = {
  'ober chef': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  'chef': 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  'owner': 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  'admin': 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  'manager': 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
}

export default function BadgeChip({ badge, size = 'sm' }: Props) {
  if (!badge) return null
  const key = badge.toLowerCase()
  const colors = BADGE_COLORS[key] ?? 'bg-accent/10 text-accent dark:bg-accent/20'
  const textSize = size === 'xs' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
  return (
    <span className={`inline-flex items-center rounded-full font-semibold leading-none ${textSize} ${colors}`}>
      {badge}
    </span>
  )
}
