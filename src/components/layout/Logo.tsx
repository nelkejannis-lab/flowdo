interface LogoProps {
  size?: 'sm' | 'md'
  full?: boolean
}

export default function Logo({ size = 'md', full = false }: LogoProps) {
  const px = size === 'sm' ? 28 : 32
  if (full) {
    return (
      <picture>
        <source media="(prefers-color-scheme: light)" srcSet="/logo-full-light.svg" />
        <img src="/logo-full-dark.svg" alt="NOVAT" height={px} style={{ height: px, width: 'auto' }} />
      </picture>
    )
  }
  return (
    <img
      src="/logo-mark.svg"
      alt="NOVAT"
      width={px}
      height={px}
      className="flex-shrink-0"
    />
  )
}
