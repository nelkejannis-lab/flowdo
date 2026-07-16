import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { shellChrome } from '../../lib/motion'

/**
 * First-load rise-fade for shell chrome (rail / sidebar / top bar).
 * Applied only to elements outside the main scrollport so sticky content stays intact.
 */
export function ShellChrome({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      variants={shellChrome(reduce, delay)}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

/** Main column: opacity entrance only (no transform → sticky-safe). */
export function ShellMain({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.36, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.06 }
      }
    >
      {children}
    </motion.div>
  )
}
