import type { Transition, Variants } from 'framer-motion'

/** NOVAT motion tokens — 3 patterns reused app-wide. Match ease-apple from Tailwind. */
export const easeApple: [number, number, number, number] = [0.25, 0.46, 0.45, 0.94]
export const easeOutSoft: [number, number, number, number] = [0.22, 1, 0.36, 1]

export const duration = {
  exit: 0.14,
  page: 0.22,
  enter: 0.32,
  shell: 0.42,
  stagger: 0.055,
} as const

/** 1) Rise-fade — shell chrome, staggered blocks (never leave transform on sticky ancestors). */
export const riseFade = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
} as const

/** 2) Page fade — opacity only so position:sticky (Quick Add) keeps working. */
export const pageFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
} as const

export const pageTransition = (reduce: boolean | null): Transition =>
  reduce
    ? { duration: 0 }
    : { duration: duration.page, ease: easeApple }

export const riseTransition = (reduce: boolean | null, delay = 0): Transition =>
  reduce
    ? { duration: 0 }
    : { duration: duration.enter, ease: easeOutSoft, delay }

/** 3) Stagger container — cascade children on first paint / section enter. */
export const staggerContainer = (reduce: boolean | null): Variants => ({
  hidden: { opacity: reduce ? 1 : 0 },
  visible: {
    opacity: 1,
    transition: reduce
      ? { duration: 0 }
      : {
          staggerChildren: duration.stagger,
          delayChildren: 0.04,
        },
  },
})

export const staggerItem = (reduce: boolean | null): Variants => ({
  hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: reduce
      ? { duration: 0 }
      : { duration: duration.enter, ease: easeOutSoft },
  },
})

export const shellChrome = (reduce: boolean | null, delay = 0): Variants => ({
  hidden: reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: riseTransition(reduce, delay),
  },
})
