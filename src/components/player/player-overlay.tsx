'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  Heart,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store/app-store'
import { useFavorites } from '@/lib/hooks/use-favorites'
import { useHlsPlayer } from '@/lib/hooks/use-hls-player'
import type { Channel } from '@/lib/types'

interface ChannelDetailResponse {
  channel?: Channel
  error?: string
}

// Same fallback used by the PreviewPopup — see preview-popup.tsx for the
// rationale (parallel Task 2-A may not have shipped streamUrl yet).
const FALLBACK_STREAM = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'

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

/**
 * PlayerOverlay
 *
 * Full-screen video player. Renders when useAppStore.playerChannel is set.
 * Reads its own channel + closePlayer from the store, fetches the streamUrl
 * from /api/channels/[id] (the channel from the store may not include it),
 * then attaches hls.js via useHlsPlayer.
 *
 * Keyboard: Escape closes the player.
 */
export function PlayerOverlay() {
  const channel = useAppStore((s) => s.playerChannel)
  const closePlayer = useAppStore((s) => s.closePlayer)
  const { isFavorite, toggleFavorite } = useFavorites()

  // Container ref used for the Fullscreen API.
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  // Resolve the streamUrl (same pattern as PreviewPopup).
  const [streamUrl, setStreamUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!channel) return
    let cancelled = false
    async function run() {
      if (!channel) return
      const direct = resolveStreamUrl(channel)
      if (channel.streamUrl) {
        if (!cancelled) setStreamUrl(direct)
        return
      }
      try {
        const res = await fetch(
          `/api/channels/${encodeURIComponent(channel.id)}`,
        )
        const data = (await res.json()) as ChannelDetailResponse
        if (cancelled) return
        if (res.ok && data.channel) {
          setStreamUrl(resolveStreamUrl(data.channel))
        } else {
          setStreamUrl(FALLBACK_STREAM)
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

  // Destructure the hook's return so consumer JSX doesn't touch a
  // ref-containing object during render (avoids the react-hooks/refs rule).
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
    muted: false,
  })

  // Escape closes the player.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // If we're in fullscreen, the browser will exit fullscreen first.
        // Only close the overlay if we're NOT in fullscreen.
        if (!document.fullscreenElement) {
          e.preventDefault()
          closePlayer()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closePlayer])

  // Track fullscreen changes so the toggle button reflects real state.
  React.useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  // Lock body scroll while the overlay is open so the background doesn't
  // scroll underneath the player.
  React.useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  function handleToggleFullscreen() {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {
        // Fullscreen denied (e.g. iframe without allow attr). Silently ignore.
      })
    } else {
      document.exitFullscreen?.().catch(() => {
        // ignore
      })
    }
  }

  if (!channel) return null

  const favorited = isFavorite(channel.id)

  const showVideoSkeleton = !streamUrl
  const showVideoError = !!playerError && !showVideoSkeleton

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      closePlayer()
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black flex items-center justify-center p-2 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing ${channel.name}`}
      ref={containerRef}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3 min-w-0">
          <ChannelLogo channel={channel} />
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-sm sm:text-base truncate">
              {channel.name}
            </h2>
            {channel.category ? (
              <p className="text-white/60 text-xs uppercase tracking-wider truncate">
                {channel.category}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={
              favorited
                ? `Remove ${channel.name} from favorites`
                : `Add ${channel.name} to favorites`
            }
            aria-pressed={favorited}
            onClick={() => toggleFavorite(channel.id)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring"
          >
            <Heart
              className={cn(
                'h-4 w-4',
                favorited ? 'fill-red-500 text-red-500' : 'text-white',
              )}
            />
          </button>
          <button
            type="button"
            aria-label="Close player"
            onClick={closePlayer}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Video stage */}
      <div
        className={cn(
          'relative w-full max-w-5xl',
          'aspect-video max-h-[80vh]',
          'rounded-xl sm:rounded-2xl overflow-hidden bg-black',
          'ring-1 ring-white/10',
        )}
      >
        <video
          ref={videoRef}
          className={cn(
            'absolute inset-0 h-full w-full object-contain bg-black',
            showVideoSkeleton ? 'opacity-0' : 'opacity-100',
          )}
          playsInline
          aria-label={`${channel.name} live stream`}
        />

        {/* Loading */}
        {(showVideoSkeleton || playerIsLoading) && !showVideoError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/80">
            <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
            <span className="text-xs">
              {showVideoSkeleton ? 'Loading stream…' : 'Buffering…'}
            </span>
          </div>
        ) : null}

        {/* Error */}
        {showVideoError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <span className="text-5xl" aria-hidden>
              {'📡'}
            </span>
            <p className="text-white font-medium">
              This stream is currently unavailable
            </p>
            <p className="text-white/70 text-sm max-w-md">
              {playerError ?? 'Please try another channel.'}
            </p>
            <button
              type="button"
              onClick={closePlayer}
              className="mt-2 focus-ring px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              Go back
            </button>
          </div>
        ) : null}

        {/* Bottom controls */}
        {!showVideoError ? (
          <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between gap-3 p-3 sm:p-4 bg-gradient-to-t from-black/80 to-transparent">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={playerIsPlaying ? 'Pause' : 'Play'}
                aria-pressed={playerIsPlaying}
                onClick={playerTogglePlay}
                disabled={showVideoSkeleton || playerIsLoading}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {playerIsPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4 fill-white" />
                )}
              </button>
              <button
                type="button"
                aria-label={playerIsMuted ? 'Unmute' : 'Mute'}
                aria-pressed={playerIsMuted}
                onClick={playerToggleMute}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring"
              >
                {playerIsMuted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
            </div>

            <button
              type="button"
              aria-label={
                isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
              }
              onClick={handleToggleFullscreen}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring"
            >
              {isFullscreen ? (
                <Minimize className="h-4 w-4" />
              ) : (
                <Maximize className="h-4 w-4" />
              )}
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

function ChannelLogo({ channel }: { channel: Channel }) {
  const { logoUrl, name } = channel
  if (logoUrl && isEmojiLogo(logoUrl)) {
    return (
      <div className="h-10 w-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center">
        <span className="text-xl" role="img" aria-label={name}>
          {emojiGlyph(logoUrl)}
        </span>
      </div>
    )
  }
  if (logoUrl && isHttpUrl(logoUrl)) {
    return (
      <div className="h-10 w-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
        <img
          src={logoUrl}
          alt={name}
          className="h-full w-full object-contain"
        />
      </div>
    )
  }
  return (
    <div className="h-10 w-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center">
      <span className="text-xl" role="img" aria-label={name}>
        {'📺'}
      </span>
    </div>
  )
}
