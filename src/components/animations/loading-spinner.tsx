'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type LoadingSpinnerSize = 'sm' | 'md' | 'lg'

export interface LoadingSpinnerProps {
  size?: LoadingSpinnerSize
  className?: string
  /** Accessible label announced by screen readers. */
  label?: string
}

const SIZE_CLASSES: Record<LoadingSpinnerSize, string> = {
  sm: 'w-6 h-6 border-2',
  md: 'w-10 h-10 border-[3px]',
  lg: 'w-16 h-16 border-4',
}

/**
 * LoadingSpinner is a glass-styled spinner that uses the primary brand
 * color for the active arc and a translucent primary for the track. It
 * plays nicely with `prefers-reduced-motion` — see globals.css where the
 * animation is paused under that media query.
 */
export function LoadingSpinner({
  size = 'md',
  className,
  label = 'Loading...',
}: LoadingSpinnerProps) {
  return (
    <div
      className={cn('inline-flex flex-col items-center gap-2', className)}
      role="status"
      aria-live="polite"
    >
      <motion.div
        className={cn(
          'rounded-full border-primary/30 border-t-primary',
          SIZE_CLASSES[size],
        )}
        animate={{ rotate: 360 }}
        transition={{
          duration: 0.9,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}
