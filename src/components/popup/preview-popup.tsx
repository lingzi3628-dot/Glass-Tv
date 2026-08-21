'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Loader2, Play, Volume2, VolumeX, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { GradientButton } from '@/components/glass/gradient-button'
import { GlassButton } from '@/components/glass/glass-button'
import { useHlsPlayer } from '@/lib/hooks/use-hls-player'
import type { Channel } from '@/lib/types'

export interface PreviewPopupProps {
  channel: Channel
  onWatch: (channel: Channel) => void
  onDismiss: () => void
  autoDismissSeconds?: number
}

interface ChannelDetailResponse {
  channel?: Channel
  error?: string
}

// Public HLS test stream used as a graceful fallback when the API hasn't
// returned a real streamUrl yet (the parallel Task 2-A updates the detail
// route to include streamUrl). This way the preview always has something
// to play in the demo.
const FALLBACK_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

/**
 * Resolve the stream URL for a channel.
 *
 * - If the channel object already carries a `streamUrl`, use it directly.
 * - Otherwise, fetch /api/channels/[id] (which is being updated by Task 2-A
 *   to include streamUrl).
 * - If neither yields a usable URL (or the URL is the seeded placeholder
 *   `stream.glasstv.example`), fall back to a known-working public test
 *   stream so the demo always shows video.
 */
function resolveStreamUrl(channelFromApi?: Channel | null): string | null {
  const raw = channelFromApi?.streamUrl
  if (!raw) return FALLBACK_STREAM
  if (/stream\.glasstv\.example/i.test(raw)) return FALLBACK_STREAM
  return raw
}

function isEmojiLogo(value?: string | null): boolean {
  return !!value && value.startsWith('emoji:')
}

function emojiGlyph(value?: string | null): string {
  if (!value) return '📺'
  if (value.startsWith('emoji:')) return value.slice('emoji:'.length)
  return '📺'
}

function isHttpUrl(value?: string | null): boolean {
  return !!value && /^https?:\/\//i.test(value)
}

const NOW_PLAYING_LINES = [
  'Live: tonight’s headline broadcast',
  'On air: featured program',
  'Streaming now: top stories',
  'Live: tonight’s main event',
  'On air: signature show',
]

export function PreviewPopup({
  channel,
  onWatch,
  onDismiss,
  autoDismissSeconds = 12,
}: PreviewPopupProps) {
  // Resolve the streamUrl (see resolveStreamUrl above).
  const [streamUrl, setStreamUrl] = React.useState<string | null>(null)
  const [fetchError, setFetchError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function run() {
      // Short-circuit if the channel already has a usable streamUrl.
      const direct = resolveStreamUrl(channel)
      if (channel.streamUrl) {
        if (!cancelled) setStreamUrl(direct)
        return
      }
      try {
        const res = await fetch(`/api/channels/${encodeURIComponent(channel.id)}`)
        const data = (await res.json()) as ChannelDetailResponse
        if (cancelled) return
        if (res.ok && data.channel) {
          setStreamUrl(resolveStreamUrl(data.channel))
        } else {
          // Fall back to the test stream so the user still sees video.
          setStreamUrl(FALLBACK_STREAM)
          setFetchError(null)
        }
      } catch {
        if (cancelled) return
        setStreamUrl(FALLBACK_STREAM)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [channel])

  // Attach hls.js. We pass the resolved streamUrl (or '' while pending so
  // the hook's guard clause `if (!video || !streamUrl) return` skips attach).
  // Destructure the values out so the consumer doesn't access the hook's
  // returned object (which also contains refs) — the react-hooks/refs rule
  // flags any property access on a ref-containing object during render.
  const {
    videoRef,
    isLoading: playerIsLoading,
    error: playerError,
    isPlaying: playerIsPlaying,
    isMuted: playerIsMuted,
    togglePlay: playerTogglePlay,
    toggleMute: playerToggleMute,
  } = useHlsPlayer({
    streamUrl: streamUrl ?? '',
    autoPlay: true,
    muted: true,
  })

  // Auto-dismiss countdown. We tick every 100ms, decrementing a ref from
  // 100 -> 0. The `progress` state drives the visual progress bar AND the
  // "auto-closes in Xs" countdown text. The timer pauses while the user
  // hovers the popup.
  const [progress, setProgress] = React.useState<number>(100)
  const hoveringRef = React.useRef<boolean>(false)
  const dismissedRef = React.useRef<boolean>(false)

  React.useEffect(() => {
    const intervalMs = 100
    const totalMs = autoDismissSeconds * 1000
    const step = (intervalMs / totalMs) * 100
    const id = window.setInterval(() => {
      if (hoveringRef.current) return
      setProgress((prev) => {
        const next = Math.max(0, prev - step)
        if (next === 0 && !dismissedRef.current) {
          dismissedRef.current = true
          // Defer the dismiss so we don't setState on an unmounted component
          // if the parent tears down the popup on its own.
          window.setTimeout(() => onDismiss(), 0)
        }
        return next
      })
    }, intervalMs)
    return () => {
      window.clearInterval(id)
    }
  }, [autoDismissSeconds, onDismiss])

  // Countdown text derived from the progress percentage.
  const secondsLeft = Math.max(
    0,
    Math.ceil((progress / 100) * autoDismissSeconds),
  )

  // Keyboard shortcuts: Esc -> dismiss, Space -> toggle play, M -> toggle mute.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onDismiss()
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        // Avoid scrolling the page when the popup is open.
        e.preventDefault()
        playerTogglePlay()
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault()
        playerToggleMute()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss, playerTogglePlay, playerToggleMute])

  // Stable fake viewer count — randomize once on mount, not on every render.
  const viewerCount = React.useMemo(() => {
    const min = 100
    const max = 9999
    return Math.floor(Math.random() * (max - min + 1)) + min
  }, [])

  const nowPlaying = React.useMemo(() => {
    // Deterministic pick based on the channel id so it's stable per channel.
    const idx = (channel.id.length + channel.name.length) % NOW_PLAYING_LINES.length
    return NOW_PLAYING_LINES[idx]
  }, [channel.id, channel.name])

  const showCenterPlay =
    !playerIsLoading && !playerError && !playerIsPlaying

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    // Only dismiss if the click was on the backdrop itself (not a child).
    if (e.target === e.currentTarget) {
      onDismiss()
    }
  }

  const showVideoSkeleton = !streamUrl
  const showVideoError = !!fetchError || (!!playerError && !showVideoSkeleton)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Previewing ${channel.name}`}
    >
      <motion.div
        className={cn(
          'glass-dark relative w-full sm:max-w-3xl',
          'rounded-t-3xl sm:rounded-3xl shadow-2xl',
          'overflow-hidden',
        )}
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.34, 1.4, 0.64, 1] }}
        onMouseEnter={() => {
          hoveringRef.current = true
        }}
        onMouseLeave={() => {
          hoveringRef.current = false
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Auto-dismiss progress bar */}
        <div
          className="h-1 w-full bg-white/10"
          role="progressbar"
          aria-label="Auto-dismiss timer"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
        >
          <div
            className="h-full bg-gradient-to-r from-primary to-secondary transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          type="button"
          aria-label="Dismiss preview"
          onClick={onDismiss}
          className="absolute top-3 right-3 z-20 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/90 hover:text-white transition-colors focus-ring"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
          {/* LEFT: video preview */}
          <div className="sm:w-3/5">
            <div
              className={cn(
                'relative w-full aspect-video overflow-hidden rounded-2xl bg-black',
                'ring-1 ring-white/10',
              )}
            >
              {/* The video element is always mounted so the ref is stable
                  for the HLS hook. It's visually hidden while we're still
                  fetching the streamUrl. */}
              <video
                ref={videoRef}
                className={cn(
                  'absolute inset-0 h-full w-full object-contain bg-black',
                  showVideoSkeleton ? 'opacity-0' : 'opacity-100',
                )}
                playsInline
                muted
                aria-label={`${channel.name} live stream`}
              />

              {/* LIVE badge */}
              {!showVideoSkeleton ? (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                    Live
                  </span>
                </div>
              ) : null}

              {/* Loading shimmer / spinner */}
              {(showVideoSkeleton || playerIsLoading) && !showVideoError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/0 animate-pulse" />
                  <Loader2 className="h-7 w-7 animate-spin relative" aria-hidden />
                  <span className="text-xs relative">
                    {showVideoSkeleton ? 'Loading stream…' : 'Buffering…'}
                  </span>
                </div>
              ) : null}

              {/* Error overlay */}
              {showVideoError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <span className="text-3xl" aria-hidden>
                    {'📡'}
                  </span>
                  <p className="text-sm font-medium text-white">
                    Stream unavailable
                  </p>
                  <p className="text-xs text-white/70 max-w-[240px]">
                    {playerError ?? fetchError ?? 'Try watching the full channel instead.'}
                  </p>
                </div>
              ) : null}

              {/* Center play button (only when paused, loaded, no error) */}
              {showCenterPlay ? (
                <button
                  type="button"
                  aria-label="Play preview"
                  onClick={playerTogglePlay}
                  className="absolute inset-0 m-auto h-14 w-14 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center focus-ring transition-colors"
                >
                  <Play className="h-6 w-6 text-white fill-white" />
                </button>
              ) : null}

              {/* Mute toggle bottom-left */}
              {!showVideoSkeleton && !showVideoError ? (
                <button
                  type="button"
                  aria-label={playerIsMuted ? 'Unmute preview' : 'Mute preview'}
                  aria-pressed={playerIsMuted}
                  onClick={playerToggleMute}
                  className="absolute bottom-2 left-2 z-10 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors focus-ring"
                >
                  {playerIsMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              ) : null}
            </div>
          </div>

          {/* RIGHT: channel info + CTAs */}
          <div className="sm:w-2/5 flex flex-col gap-3 text-white">
            <div className="flex items-start gap-3">
              <ChannelLogo channel={channel} />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-base leading-tight text-white truncate">
                  {channel.name}
                </h3>
                {channel.category ? (
                  <p className="mt-0.5 text-xs uppercase tracking-wider text-white/60">
                    {channel.category}
                  </p>
                ) : null}
              </div>
            </div>

            <p className="text-xs text-white/70 italic leading-relaxed">
              {nowPlaying}
            </p>

            <div className="flex items-center gap-3 text-[11px] text-white/60">
              <span className="inline-flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                {viewerCount.toLocaleString()} watching
              </span>
              <span aria-hidden>·</span>
              <span>Closes in {secondsLeft}s</span>
            </div>

            <div className="mt-auto flex flex-col gap-2 pt-2">
              <GradientButton
                size="md"
                onClick={() => onWatch(channel)}
                className="w-full"
              >
                <Play className="h-4 w-4 mr-2 fill-white" aria-hidden />
                Watch Now
              </GradientButton>
              <GlassButton
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="w-full text-white/80 hover:text-white hover:bg-white/10"
              >
                Maybe Later
              </GlassButton>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ChannelLogo({ channel }: { channel: Channel }) {
  const { logoUrl, name } = channel
  if (logoUrl && isEmojiLogo(logoUrl)) {
    return (
      <div className="h-11 w-11 shrink-0 rounded-xl bg-white/10 flex items-center justify-center">
        <span className="text-2xl" role="img" aria-label={name}>
          {emojiGlyph(logoUrl)}
        </span>
      </div>
    )
  }
  if (logoUrl && isHttpUrl(logoUrl)) {
    return (
      <div className="h-11 w-11 shrink-0 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
        <img
          src={logoUrl}
          alt={name}
          className="h-full w-full object-contain"
        />
      </div>
    )
  }
  return (
    <div className="h-11 w-11 shrink-0 rounded-xl bg-white/10 flex items-center justify-center">
      <span className="text-2xl" role="img" aria-label={name}>
        {'📺'}
      </span>
    </div>
  )
}
