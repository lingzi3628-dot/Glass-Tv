'use client'

import * as React from 'react'

import {
  useAudioCapture,
  type AudioChunk,
} from '@/hooks/use-audio-capture'
import { CaptionOverlay } from './caption-overlay'

/**
 * CaptionsController
 *
 * Wires audio capture → /api/captions → caption text → CaptionOverlay.
 *
 * Behavior:
 * - When `enabled` is true and a videoElement is present, calls
 *   `useAudioCapture.startCapture(videoElement)`.
 * - Each captured chunk is enqueued and processed one-at-a-time: POSTs to
 *   /api/captions with { audio, channelId, timestamp, language }. On
 *   success, sets the current caption text. On 503 (model still loading),
 *   retries after 2s. On other errors, skips the chunk.
 * - If `useAudioCapture` reports an error (e.g. CORS-silence), switches to
 *   demo mode: cycles through a small set of sample captions every 4s so
 *   the UI is still demonstrable.
 * - On `enabled` flipping to false (or unmount): stops capture and clears
 *   the caption.
 *
 * Renders the CaptionOverlay + a small "AI Captions" processing indicator
 * (pulsing dot + label) in the top-right while a chunk is in flight.
 */
export interface CaptionsControllerProps {
  videoElement: HTMLVideoElement | null
  channelId: string
  enabled: boolean
  language: string
  fontSize?: number
  fontColor?: string
  backgroundColor?: string
  position?: 'top' | 'middle' | 'bottom'
  /** Optional channel name used to enrich the demo captions. */
  channelName?: string
}

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface CaptionsApiResponse {
  text?: string
  cached?: boolean
  timestamp?: number
  error?: string
  loading?: boolean
}

/* ------------------------------------------------------------------ */
/* Demo captions (used when audio capture is unavailable, e.g. CORS)   */
/* ------------------------------------------------------------------ */

const BASE_DEMO_CAPTIONS = [
  'Welcome to GlassTV',
  'Live broadcast in progress',
  'Stay tuned for more great content',
  'You are watching a GlassTV channel',
  'Thanks for tuning in',
  'Experience AI-powered captions',
  'High-quality streaming on every device',
  'Don\u2019t go anywhere, we\u2019ll be right back',
]

const DEMO_INTERVAL_MS = 4000

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function CaptionsController({
  videoElement,
  channelId,
  enabled,
  language,
  fontSize,
  fontColor,
  backgroundColor,
  position,
  channelName,
}: CaptionsControllerProps) {
  const [currentText, setCurrentText] = React.useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = React.useState(false)
  const [demoMode, setDemoMode] = React.useState(false)

  // Chunk queue + "is the worker currently draining it" flag. Both live in
  // refs so they survive re-renders without triggering them.
  const queueRef = React.useRef<AudioChunk[]>([])
  const drainingRef = React.useRef(false)

  // Mirror props into refs so callbacks (which we don't want to re-create on
  // every render) always see the latest values.
  const channelIdRef = React.useRef(channelId)
  const languageRef = React.useRef(language)
  React.useEffect(() => {
    channelIdRef.current = channelId
  }, [channelId])
  React.useEffect(() => {
    languageRef.current = language
  }, [language])

  /* -------------------- audio-capture wiring -------------------- */

  const handleChunk = React.useCallback((chunk: AudioChunk) => {
    queueRef.current.push(chunk)
    void drainQueue()
  }, [])

  const handleError = React.useCallback(() => {
    // CORS, unsupported, or already-connected → fall back to demo mode so
    // the UI is still demonstrable.
    setDemoMode(true)
    setIsTranscribing(false)
    queueRef.current = []
    drainingRef.current = false
  }, [])

  const { startCapture, stopCapture } = useAudioCapture({
    enabled,
    onChunk: handleChunk,
    onError: handleError,
  })

  /* -------------------- queue draining -------------------- */

  const drainQueue = React.useCallback(async () => {
    if (drainingRef.current) return
    const next = queueRef.current.shift()
    if (!next) return
    drainingRef.current = true
    setIsTranscribing(true)

    try {
      await processChunk(next)
    } finally {
      drainingRef.current = false
      setIsTranscribing(queueRef.current.length > 0)
      // If more chunks queued, keep draining.
      if (queueRef.current.length > 0) {
        void drainQueue()
      }
    }
  }, [])

  const processChunk = React.useCallback(
    async (chunk: AudioChunk): Promise<void> => {
      const MAX_RETRIES = 5
      const RETRY_MS = 2000

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        let res: Response
        try {
          res = await fetch('/api/captions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audio: chunk.data,
              channelId: channelIdRef.current,
              timestamp: chunk.timestamp,
              language: languageRef.current,
            }),
          })
        } catch {
          // Network error - skip this chunk.
          return
        }

        // 503 = model still loading on the server. Retry after 2s.
        if (res.status === 503) {
          await sleep(RETRY_MS)
          continue
        }

        if (!res.ok) {
          // Any other error - skip.
          return
        }

        let data: CaptionsApiResponse
        try {
          data = (await res.json()) as CaptionsApiResponse
        } catch {
          return
        }

        if (data.loading) {
          await sleep(RETRY_MS)
          continue
        }

        if (typeof data.text === 'string' && data.text.trim().length > 0) {
          setCurrentText(data.text)
        }
        return
      }
      // Exhausted retries - give up silently on this chunk.
    },
    [],
  )

  /* -------------------- demo mode cycling -------------------- */

  React.useEffect(() => {
    if (!enabled || !demoMode) {
      return
    }
    const captions = BASE_DEMO_CAPTIONS.map((c) =>
      c === 'You are watching a GlassTV channel' && channelName
        ? `You are watching ${channelName}`
        : c,
    )
    let idx = 0
    setCurrentText(captions[0])
    const timer = window.setInterval(() => {
      idx = (idx + 1) % captions.length
      setCurrentText(captions[idx])
    }, DEMO_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
    }
  }, [enabled, demoMode, channelName])

  /* -------------------- start / stop capture based on enabled + video -------------------- */

  React.useEffect(() => {
    if (!enabled) {
      stopCapture()
      queueRef.current = []
      drainingRef.current = false
      setIsTranscribing(false)
      setCurrentText(null)
      // Don't reset demoMode here - if capture is later re-enabled and the
      // stream is still CORS-blocked, we want to fall back again.
      // But if we're turning OFF captions, clear any demo text too.
      setDemoMode(false)
      return
    }

    if (!videoElement) return

    // Captions on + we have a video → start capturing.
    startCapture(videoElement)

    return () => {
      stopCapture()
      queueRef.current = []
      drainingRef.current = false
      setIsTranscribing(false)
    }
  }, [enabled, videoElement, startCapture, stopCapture])

  /* -------------------- render -------------------- */

  return (
    <>
      <CaptionOverlay
        text={currentText}
        enabled={enabled}
        fontSize={fontSize}
        fontColor={fontColor}
        backgroundColor={backgroundColor}
        position={position}
      />

      {enabled && (isTranscribing || demoMode) && (
        <ProcessingIndicator demoMode={demoMode} />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Processing indicator                                                */
/* ------------------------------------------------------------------ */

interface ProcessingIndicatorProps {
  demoMode: boolean
}

function ProcessingIndicator({ demoMode }: ProcessingIndicatorProps) {
  const label = demoMode ? 'Demo captions' : 'AI captions'
  return (
    <div
      className="absolute top-8 right-8 z-10 flex items-center gap-2 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1.5 text-white text-xs font-medium pointer-events-none"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
            demoMode ? 'bg-amber-400' : 'bg-primary'
          } animate-ping`}
        />
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${
            demoMode ? 'bg-amber-400' : 'bg-primary'
          }`}
        />
      </span>
      <span>{label}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* utils                                                               */
/* ------------------------------------------------------------------ */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
