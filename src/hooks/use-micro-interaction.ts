'use client'

import * as React from 'react'

export interface UseMicroInteractionOptions {
  /** Fired on press-down (mouse/touch). */
  onPress?: () => void
  /** Fired on release (mouse/touch). */
  onRelease?: () => void
  /** If true (default), trigger a 10ms navigator.vibrate() on press. */
  haptic?: boolean
}

export interface MicroInteractionHandlers {
  onMouseDown: () => void
  onMouseUp: () => void
  onMouseLeave: () => void
  onMouseEnter: () => void
  onTouchStart: () => void
  onTouchEnd: () => void
}

export interface UseMicroInteractionResult {
  isPressed: boolean
  isHovered: boolean
  handlers: MicroInteractionHandlers
}

/**
 * useMicroInteraction exposes press + hover state plus a stable bundle of
 * pointer handlers that callers can spread onto any element. It also fires
 * an optional haptic pulse (navigator.vibrate(10)) on press — wrapped in
 * try/catch so non-supporting browsers (Safari/desktop) are no-ops.
 *
 * The returned `handlers` object is memoized so it won't bust downstream
 * `React.memo` boundaries on every render.
 */
export function useMicroInteraction({
  onPress,
  onRelease,
  haptic = true,
}: UseMicroInteractionOptions = {}): UseMicroInteractionResult {
  const [isPressed, setIsPressed] = React.useState(false)
  const [isHovered, setIsHovered] = React.useState(false)

  const triggerHaptic = React.useCallback(() => {
    if (!haptic) return
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(10)
      }
    } catch {
      // navigator.vibrate can throw on some browsers when permissions
      // are denied — silently ignore.
    }
  }, [haptic])

  const handlePress = React.useCallback(() => {
    setIsPressed(true)
    triggerHaptic()
    onPress?.()
  }, [onPress, triggerHaptic])

  const handleRelease = React.useCallback(() => {
    setIsPressed(false)
    onRelease?.()
  }, [onRelease])

  const handlers = React.useMemo<MicroInteractionHandlers>(
    () => ({
      onMouseDown: handlePress,
      onMouseUp: handleRelease,
      onMouseLeave: () => {
        setIsHovered(false)
        setIsPressed(false)
      },
      onMouseEnter: () => setIsHovered(true),
      onTouchStart: handlePress,
      onTouchEnd: handleRelease,
    }),
    [handlePress, handleRelease],
  )

  return { isPressed, isHovered, handlers }
}
