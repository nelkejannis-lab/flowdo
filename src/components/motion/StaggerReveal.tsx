import { type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { staggerContainer, staggerItem } from '../../lib/motion'

/** Cascade children with rise-fade. Safe below sticky chrome (transforms on children only). */
export function StaggerReveal({
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
      variants={staggerContainer(reduce)}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()

  return (
    <motion.div className={className} variants={staggerItem(reduce)}>
      {children}
    </motion.div>
  )
}
