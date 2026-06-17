interface UserAvatarProps {
  name: string
  color: string
  avatarUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
}

export default function UserAvatar({ name, color, avatarUrl, size = 'md', className = '' }: UserAvatarProps) {
  const cls = `flex-shrink-0 rounded-full overflow-hidden ${sizeClasses[size]} ${className}`
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${cls} object-cover`}
      />
    )
  }
  return (
    <span
      className={`${cls} flex items-center justify-center font-semibold text-white`}
      style={{ backgroundColor: color }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  )
}
