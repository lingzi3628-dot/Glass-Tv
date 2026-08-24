'use client'

import * as React from 'react'
import { motion, type Variants } from 'framer-motion'

const EASE_SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1]

export interface FadeInProps {
  children: React.ReactNode
  /** Delay (seconds) before the fade starts. */
  delay?: number
  /** Fade duration in seconds. */
  duration?: number
  className?: string
  /** Optional y-offset to fade up from (set 0 for pure opacity). */
  y?: number
}

/**
 * FadeIn is the simplest wrapper: just opacity (and optional y) on mount.
 * Use it for hero regions, CTAs, or any element that should ease in once
 * without scroll tracking.
 */
export function FadeIn({
  children,
  delay = 0,
  duration = 0.5,
  className,
  y = 0,
}: FadeInProps) {
  const variants: Variants = {
    hidden: { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration, delay, ease: EASE_SPRING },
    },
  }

  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  )
}
