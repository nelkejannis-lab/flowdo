import { motion, useReducedMotion } from 'framer-motion'
import { riseFade, riseTransition } from '../../lib/motion'
import Logo from '../layout/Logo'

/** Short first-paint loader — logo rise-fade, not a splash screen. */
export default function BootLoader({
  label,
  dark = false,
}: {
  label: string
  /** Match login screen while auth is restoring a session. */
  dark?: boolean
}) {
  const reduce = useReducedMotion()

  return (
    <div
      className={
        dark
          ? 'flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-white/50'
          : 'flex min-h-screen flex-col items-center justify-center gap-4 bg-[rgb(var(--surface-0))] text-gray-400'
      }
    >
      <motion.div
        initial={reduce ? false : riseFade.hidden}
        animate={riseFade.visible}
        transition={riseTransition(reduce)}
        className="flex flex-col items-center gap-3"
      >
        <Logo size="md" />
        <p className="text-sm font-medium tracking-wide text-gray-400">{label}</p>
      </motion.div>
    </div>
  )
}
