interface LogoProps {
  size?: 'sm' | 'md'
  full?: boolean
}

export default function Logo({ size = 'md', full = false }: LogoProps) {
  const px = size === 'sm' ? 28 : 32
  if (full) {
    return (
      <img src="/logo-full.svg" alt="MoonCrew" height={px} style={{ height: px, width: 'auto' }} />
    )
  }
  return (
    <img
      src="/icons/icon-96.png"
      alt="MoonCrew"
      width={px}
      height={px}
      className="flex-shrink-0 rounded-xl"
    />
  )
}
