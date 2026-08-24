'use client'

import * as React from 'react'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { usePathname } from 'next/navigation'

/**
 * Spring-like ease curve shared across GlassTV transitions.
 * Pulled out as a `const` tuple so framer-motion's Variants type is satisfied
 * (it requires a 4-tuple, not a `number[]`).
 */
const EASE_SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1]

export interface PageTransitionProps {
  children: React.ReactNode
  /**
   * Explicit transition key. Pass this when the URL won't change but the
   * view should still animate (e.g. switching between SPA views like
   * `landing` -> `login` -> `app`). When omitted, the current pathname is
   * used instead.
   */
  id?: string
  /** Animation duration in seconds. Defaults to 0.4. */
  duration?: number
}

const variants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

/**
 * PageTransition wraps a routed view and animates it in/out on change.
 *
 * Use this around the main content of any top-level route so that navigation
 * feels physical instead of instantly swapping. For SPA views that don't
 * change the URL, pass an explicit `id` prop to drive the transition.
 */
export function PageTransition({
  children,
  id,
  duration = 0.4,
}: PageTransitionProps) {
  const pathname = usePathname()
  const transitionKey = id ?? pathname

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={transitionKey}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration, ease: EASE_SPRING }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
