import { Moon, Rocket } from 'lucide-react'

interface LogoProps {
  size?: 'sm' | 'md'
}

export default function Logo({ size = 'md' }: LogoProps) {
  const box = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'
  const moonSize = size === 'sm' ? 16 : 18
  const rocketSize = size === 'sm' ? 11 : 12

  return (
    <div
      className={`relative flex ${box} flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-accent to-accent-dark text-white`}
    >
      <Moon size={moonSize} className="absolute opacity-50" />
      <Rocket size={rocketSize} className="relative -translate-x-px translate-y-px -rotate-45" />
    </div>
  )
}
