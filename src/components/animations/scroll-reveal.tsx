'use client'

import * as React from 'react'
import { motion, useInView, type Variants } from 'framer-motion'

const EASE_SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1]

export type ScrollRevealDirection = 'up' | 'down' | 'left' | 'right' | 'none'

export interface ScrollRevealProps {
  children: React.ReactNode
  /** Direction the content travels from. Defaults to 'up'. */
  direction?: ScrollRevealDirection
  /** Delay (seconds) before the reveal starts. */
  delay?: number
  /** Animation duration in seconds. */
  duration?: number
  /** Reveal only once (true) or every time it enters the viewport (false). */
  once?: boolean
  /** Travel distance in pixels. */
  distance?: number
  className?: string
  /** Optional element to render (defaults to div). */
  as?: keyof React.JSX.IntrinsicElements
}

function offsetFor(
  direction: ScrollRevealDirection,
  distance: number,
): { x: number; y: number } {
  switch (direction) {
    case 'up':
      return { x: 0, y: distance }
    case 'down':
      return { x: 0, y: -distance }
    case 'left':
      return { x: distance, y: 0 }
    case 'right':
      return { x: -distance, y: 0 }
    case 'none':
    default:
      return { x: 0, y: 0 }
  }
}

/**
 * ScrollReveal fades + slides its children into view the first time they
 * enter the viewport. Uses framer-motion's `useInView` hook directly —
 * there is no `hasAnimated` state, so this is safe under React's StrictMode
 * and won't trigger setState-in-effect lint warnings.
 */
export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.6,
  once = true,
  distance = 50,
  className,
}: ScrollRevealProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin: '-50px 0px' })

  const { x, y } = offsetFor(direction, distance)

  const variants: Variants = {
    hidden: { opacity: 0, x, y },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, delay, ease: EASE_SPRING },
    },
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      {children}
    </motion.div>
  )
}
