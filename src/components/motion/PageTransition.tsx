import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { pageFade, pageTransition } from '../../lib/motion'

/**
 * Route enter/exit — opacity only.
 * Avoid transform/filter on this wrapper: they create a containing block and break sticky Quick Add.
 */
export default function PageTransition() {
  const location = useLocation()
  const reduce = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduce ? false : pageFade.initial}
        animate={pageFade.animate}
        exit={reduce ? undefined : pageFade.exit}
        transition={pageTransition(reduce)}
        className="min-h-full"
      >
        <Outlet />
      </motion.div>
    </AnimatePresence>
  )
}
