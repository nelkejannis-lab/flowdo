interface LogoProps {
  size?: 'sm' | 'md'
}

export default function Logo({ size = 'md' }: LogoProps) {
  const px = size === 'sm' ? 28 : 32
  return (
    <img
      src="/icon.svg"
      alt="MoonCrew"
      width={px}
      height={px}
      className="flex-shrink-0 rounded-xl"
      style={{ imageRendering: 'auto' }}
    />
  )
}
