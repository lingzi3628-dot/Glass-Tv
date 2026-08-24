'use client'

import * as React from 'react'
import { motion, type Variants } from 'framer-motion'

const EASE_SPRING: [number, number, number, number] = [0.34, 1.56, 0.64, 1]

export type StaggerGridDirection = 'up' | 'down' | 'left' | 'right' | 'none'

export interface StaggerGridProps {
  /** Each item becomes a staggered child. */
  children: React.ReactNode[]
  className?: string
  /** Per-item stagger delay in seconds. */
  staggerDelay?: number
  /** Per-item animation duration. */
  duration?: number
  /** Direction items travel from. Defaults to 'up'. */
  direction?: StaggerGridDirection
  /** Travel distance in pixels. */
  distance?: number
  /** Delay before the whole grid starts revealing. */
  delay?: number
}

function offsetFor(
  direction: StaggerGridDirection,
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
 * StaggerGrid renders a list of children inside a motion container that
 * staggers their entrance. The container itself starts hidden and animates
 * to visible on mount; each child inherits the parent's variant and pops in
 * one after another.
 *
 * NOTE: children must be plain ReactNode[] (an array), not a single node.
 * Each item is wrapped in motion.div, so callers should NOT wrap items in
 * their own motion.div with initial/animate — that would conflict with the
 * staggered parent variants.
 */
export function StaggerGrid({
  children,
  className,
  staggerDelay = 0.08,
  duration = 0.5,
  direction = 'up',
  distance = 50,
  delay = 0,
}: StaggerGridProps) {
  const { x, y } = offsetFor(direction, distance)

  const container: Variants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: delay,
      },
    },
  }

  const item: Variants = {
    hidden: { opacity: 0, x, y },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { duration, ease: EASE_SPRING },
    },
  }

  return (
    <motion.div
      className={className}
      variants={container}
      initial="hidden"
      animate="visible"
    >
      {children.map((child, i) => (
        <motion.div key={i} variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  )
}
