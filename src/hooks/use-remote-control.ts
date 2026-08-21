'use client'

import * as React from 'react'

/**
 * useRemoteControl
 *
 * Smart TV D-pad navigation hook. Registers a `keydown` listener on
 * `document` that handles:
 *
 *   - Arrow Up/Down/Left/Right (D-pad navigation between focusable elements,
 *     or the consumer's onArrowX override)
 *   - Enter (click the focused element, or onEnter override)
 *   - Escape / Backspace (onBack)
 *   - Space / MediaPlayPause (onTogglePlay)
 *   - MediaPlay / MediaPause / MediaStop (onPlay / onPause)
 *   - `f` (onFullscreen), `m` (onMute)
 *   - Number keys 0-9 (onNumber)
 *   - VolumeUp / VolumeDown / VolumeMute / AudioVolumeMute (onVolumeUp /
 *     onVolumeDown / onMute)
 *
 * The hook also maintains a live list of focusable elements (queried from
 * `focusContainer?.current || document` using `focusSelector`). A
 * MutationObserver keeps the list fresh as the DOM changes. Returned
 * helpers (`focusFirst` / `focusNext` / `focusPrevious`) let the consumer
 * programmatically move focus - useful for Smart TV remotes that emit
 * arrow keys for D-pad navigation.
 *
 * As a small accessibility polyfill, the hook adds a `using-keyboard` class
 * to <html> on any keydown and removes it on mousedown. Combined with the
 * injected `.using-keyboard .focus-ring:focus` style, this makes
 * programmatic focus visible during keyboard/remote navigation (which the
 * default `:focus-visible` selector doesn't, since programmatic .focus()
 * doesn't set the focus-visible flag).
 *
 * Spec extension: the original interface lists `onPlay` and `onPause`
 * separately, but Space and MediaPlayPause are inherently toggle keys. We
 * add an optional `onTogglePlay` callback that the hook prefers for those
 * two keys. `onPlay`/`onPause` are still wired to MediaPlay / MediaPause /
 * MediaStop.
 */

export interface RemoteControlOptions {
  enabled?: boolean
  onEnter?: () => void
  onBack?: () => void
  onArrowUp?: () => void
  onArrowDown?: () => void
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onPlay?: () => void
  onPause?: () => void
  /** Called for Space / MediaPlayPause. */
  onTogglePlay?: () => void
  onVolumeUp?: () => void
  onVolumeDown?: () => void
  onMute?: () => void
  onFullscreen?: () => void
  onNumber?: (num: number) => void
  focusSelector?: string
  focusContainer?: React.RefObject<HTMLElement | null>
}

export interface RemoteControlResult {
  focusableElements: HTMLElement[]
  currentFocusIndex: number
  focusFirst: () => void
  focusNext: () => void
  focusPrevious: () => void
  updateFocusableElements: () => void
}

const KEYBOARD_FOCUS_STYLE_ID = 'glasstv-keyboard-focus-style'
const KEYBOARD_FOCUS_STYLE_CSS = `
  .using-keyboard .focus-ring:focus {
    box-shadow: 0 0 0 4px oklch(0.7 0.18 290 / 0.5), 0 0 0 2px #fff;
    outline: none;
  }
`

function injectKeyboardFocusStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById(KEYBOARD_FOCUS_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = KEYBOARD_FOCUS_STYLE_ID
  style.textContent = KEYBOARD_FOCUS_STYLE_CSS
  document.head.appendChild(style)
}

const DEFAULT_FOCUS_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function useRemoteControl(
  options: RemoteControlOptions = {},
): RemoteControlResult {
  const {
    enabled = true,
    focusSelector = DEFAULT_FOCUS_SELECTOR,
    focusContainer,
  } = options

  const [focusableElements, setFocusableElements] = React.useState<
    HTMLElement[]
  >([])
  const [currentFocusIndex, setCurrentFocusIndex] = React.useState(-1)

  // Keep refs to the latest options + helpers so the keydown listener
  // doesn't need to be re-registered on every callback change. Refs are
  // updated in effects (never during render) to satisfy the
  // react-hooks/refs lint rule.
  const optionsRef = React.useRef(options)
  React.useEffect(() => {
    optionsRef.current = options
  })

  // Ref-stored `updateFocusableElements` so the exposed callback is stable
  // (empty deps) but always calls the latest impl. This avoids accessing
  // `focusContainer.current` inside a useCallback, which the React
  // Compiler's preserve-manual-memoization rule flags.
  const updateFnRef = React.useRef<() => void>(() => {})

  const updateFocusableElements = React.useCallback(() => {
    updateFnRef.current()
  }, [])

  // Build the latest update impl whenever focusContainer/focusSelector
  // changes, run it once, and wire up a MutationObserver.
  React.useEffect(() => {
    if (!enabled) return
    if (typeof document === 'undefined') return

    function update() {
      if (typeof document === 'undefined') return
      const root: HTMLElement | Document =
        focusContainer?.current ?? document
      const els = Array.from(
        root.querySelectorAll<HTMLElement>(focusSelector),
      ).filter((el) => {
        if (el.hasAttribute('disabled')) return false
        if (el.getAttribute('aria-hidden') === 'true') return false
        if (el.getAttribute('tabindex') === '-1') return false
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 && rect.height === 0) return false
        return true
      })
      setFocusableElements(els)
    }

    updateFnRef.current = update
    update()

    const root: HTMLElement | Document =
      focusContainer?.current ?? document.body
    if (typeof MutationObserver === 'undefined') return

    const observer = new MutationObserver(() => {
      update()
    })
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'style', 'class'],
    })
    return () => observer.disconnect()
  }, [enabled, focusContainer, focusSelector])

  const focusFirst = React.useCallback(() => {
    updateFnRef.current()
    setFocusableElements((els) => {
      if (els.length === 0) return els
      els[0]?.focus()
      setCurrentFocusIndex(0)
      return els
    })
  }, [])

  const focusNext = React.useCallback(() => {
    setFocusableElements((els) => {
      if (els.length === 0) return els
      const active = document.activeElement
      let idx = els.findIndex((el) => el === active)
      if (idx === -1) idx = currentFocusIndex
      const nextIdx = (idx + 1) % els.length
      els[nextIdx]?.focus()
      setCurrentFocusIndex(nextIdx)
      return els
    })
  }, [currentFocusIndex])

  const focusPrevious = React.useCallback(() => {
    setFocusableElements((els) => {
      if (els.length === 0) return els
      const active = document.activeElement
      let idx = els.findIndex((el) => el === active)
      if (idx === -1) idx = currentFocusIndex
      const prevIdx = (idx - 1 + els.length) % els.length
      els[prevIdx]?.focus()
      setCurrentFocusIndex(prevIdx)
      return els
    })
  }, [currentFocusIndex])

  // Inject the keyboard-focus polyfill style once.
  React.useEffect(() => {
    if (!enabled) return
    injectKeyboardFocusStyle()
  }, [enabled])

  // Main keydown listener.
  React.useEffect(() => {
    if (!enabled) return
    if (typeof document === 'undefined') return

    function onKeyDown(e: KeyboardEvent) {
      const opts = optionsRef.current
      // Mark the page as using keyboard navigation so focus rings show.
      document.documentElement.classList.add('using-keyboard')

      const key = e.key

      // Arrow keys - either the consumer's override or D-pad navigation.
      if (key === 'ArrowUp') {
        if (opts.onArrowUp) {
          e.preventDefault()
          opts.onArrowUp()
        } else {
          e.preventDefault()
          focusPrevious()
        }
        return
      }
      if (key === 'ArrowDown') {
        if (opts.onArrowDown) {
          e.preventDefault()
          opts.onArrowDown()
        } else {
          e.preventDefault()
          focusNext()
        }
        return
      }
      if (key === 'ArrowLeft') {
        if (opts.onArrowLeft) {
          e.preventDefault()
          opts.onArrowLeft()
        } else {
          e.preventDefault()
          focusPrevious()
        }
        return
      }
      if (key === 'ArrowRight') {
        if (opts.onArrowRight) {
          e.preventDefault()
          opts.onArrowRight()
        } else {
          e.preventDefault()
          focusNext()
        }
        return
      }

      // Enter - click focused element (or onEnter override).
      if (key === 'Enter') {
        if (opts.onEnter) {
          opts.onEnter()
          return
        }
        const active = document.activeElement as HTMLElement | null
        if (active && typeof active.click === 'function') {
          e.preventDefault()
          active.click()
        }
        return
      }

      // Back / Escape / Backspace.
      if (key === 'Escape' || key === 'Backspace') {
        if (opts.onBack) {
          e.preventDefault()
          opts.onBack()
        }
        return
      }

      // Play / pause toggle (Space, MediaPlayPause).
      if (key === ' ' || key === 'Spacebar' || key === 'MediaPlayPause') {
        if (opts.onTogglePlay) {
          e.preventDefault()
          opts.onTogglePlay()
        } else if (opts.onPlay) {
          e.preventDefault()
          opts.onPlay()
        }
        return
      }
      if (key === 'MediaPlay') {
        e.preventDefault()
        opts.onPlay?.()
        return
      }
      if (key === 'MediaPause' || key === 'MediaStop') {
        e.preventDefault()
        opts.onPause?.()
        return
      }

      // Volume keys.
      if (key === 'VolumeUp' || key === 'AudioVolumeUp') {
        e.preventDefault()
        opts.onVolumeUp?.()
        return
      }
      if (key === 'VolumeDown' || key === 'AudioVolumeDown') {
        e.preventDefault()
        opts.onVolumeDown?.()
        return
      }
      if (key === 'VolumeMute' || key === 'AudioVolumeMute') {
        e.preventDefault()
        opts.onMute?.()
        return
      }

      // Single-letter shortcuts.
      if (key === 'f' || key === 'F') {
        e.preventDefault()
        opts.onFullscreen?.()
        return
      }
      if (key === 'm' || key === 'M') {
        e.preventDefault()
        opts.onMute?.()
        return
      }

      // Number keys 0-9.
      if (/^[0-9]$/.test(key)) {
        e.preventDefault()
        opts.onNumber?.(parseInt(key, 10))
        return
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [enabled, focusNext, focusPrevious])

  // Remove the using-keyboard class on mouse interaction.
  React.useEffect(() => {
    if (!enabled) return
    if (typeof document === 'undefined') return
    function onMouseDown() {
      document.documentElement.classList.remove('using-keyboard')
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('mouseup', onMouseDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('mouseup', onMouseDown)
      document.documentElement.classList.remove('using-keyboard')
    }
  }, [enabled])

  return {
    focusableElements,
    currentFocusIndex,
    focusFirst,
    focusNext,
    focusPrevious,
    updateFocusableElements,
  }
}
