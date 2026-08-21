'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { cn } from '@/lib/utils'

/**
 * CaptionOverlay
 *
 * Renders the active AI-caption text on top of the video. Purely
 * presentational - the parent (CaptionsController) owns the text and
 * styling props. The overlay is `pointer-events-none` so it never
 * intercepts clicks on the player surface.
 *
 * Animation: fades + slides up a few px on enter, fades + slides down on
 * exit (via framer-motion `AnimatePresence`).
 */
export interface CaptionOverlayProps {
  /** Current caption text. Null/empty hides the caption. */
  text: string | null
  /** Master toggle - when false, renders nothing (no exit animation). */
  enabled: boolean
  /** Pixel font size. Default 18. */
  fontSize?: number
  /** Hex/rgba CSS color. Default '#FFFFFF'. */
  fontColor?: string
  /** CSS background color (any valid `background-color` value). Default 'rgba(0,0,0,0.75)'. */
  backgroundColor?: string
  /** Vertical placement. Default 'bottom'. */
  position?: 'top' | 'middle' | 'bottom'
}

const POSITION_CLASS: Record<
  NonNullable<CaptionOverlayProps['position']>,
  string
> = {
  // bottom-20 sits just above the Player's bottom control bar.
  bottom: 'bottom-20',
  top: 'top-8',
  middle: 'top-1/2 -translate-y-1/2',
}

export function CaptionOverlay({
  text,
  enabled,
  fontSize = 18,
  fontColor = '#FFFFFF',
  backgroundColor = 'rgba(0,0,0,0.75)',
  position = 'bottom',
}: CaptionOverlayProps) {
  // Master toggle off → render nothing at all (the parent already controls
  // mounting, but be defensive).
  if (!enabled) return null

  const hasText = !!text && text.trim().length > 0

  return (
    <div
      className={cn(
        'absolute inset-x-0 z-10 flex justify-center px-4 pointer-events-none',
        POSITION_CLASS[position],
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence>
        {hasText && (
          <motion.div
            key="caption"
            className="max-w-[90%] text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <span
              className="inline-block px-4 py-2 rounded-xl backdrop-blur-sm font-medium leading-snug shadow-lg"
              style={{
                fontSize: `${fontSize}px`,
                color: fontColor,
                backgroundColor,
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              }}
            >
              {text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
