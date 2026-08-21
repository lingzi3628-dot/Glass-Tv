'use client'

import * as React from 'react'
import Hls from 'hls.js'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  Heart,
  Loader2,
  Play,
  RefreshCw,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { Channel } from '@/lib/types'
import { usePlayerStore, type QualityLevel } from '@/lib/store/player-store'
import { useFavorites } from '@/lib/hooks/use-favorites'
import { useRemoteControl } from '@/hooks/use-remote-control'
import { PlayerControls } from './player-controls'
import { PlayerSettings } from './player-settings'

/**
 * Player
 *
 * Full-screen video player for a single channel. Replaces the Phase 2
 * PlayerOverlay with a much richer experience: quality selector, playback
 * rate, PiP, a settings modal, Smart TV remote support, watch history
 * recording, auto-hiding controls, and a seek bar (for non-live streams).
 *
 * All playback state lives in `usePlayerStore`. The Player subscribes to
 * slices of the store and applies them to the underlying <video> element
 * via effects. The video's own events sync back into the store so the UI
 * always reflects the real playback state.
 *
 * hls.js is set up directly here (NOT via the Phase 2 useHlsPlayer hook)
 * because the Player needs fine-grained control over quality levels,
 * buffering events, etc.
 *
 * Watch history: POST /api/history every 30s while playing, and on unmount
 * if currentTime > 5 (uses sendBeacon so it fires even if the page is
 * closing).
 */
export interface PlayerProps {
  /** The full channel object - must include `streamUrl` to start playback. */
  channel: Channel
  /** Close the player. */
  onBack?: () => void
}

interface ChannelDetailResponse {
  channel?: Channel
  error?: string
}

// Same fallback used by PreviewPopup / PlayerOverlay - keeps the demo
// working when a channel's streamUrl isn't resolvable.
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

function levelLabel(height: number | undefined): string {
  if (!height || height <= 0) return 'Auto'
  if (height >= 2160) return '4K'
  if (height >= 1440) return '1440p'
  if (height >= 1080) return '1080p'
  if (height >= 720) return '720p'
  if (height >= 480) return '480p'
  if (height >= 360) return '360p'
  if (height >= 240) return '240p'
  return `${height}p`
}

export function Player({ channel, onBack }: PlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const hlsRef = React.useRef<Hls | null>(null)

  // --- Store state (subscribe to slices to minimize re-renders) ---
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const volume = usePlayerStore((s) => s.volume)
  const currentTime = usePlayerStore((s) => s.currentTime)
  const duration = usePlayerStore((s) => s.duration)
  const buffering = usePlayerStore((s) => s.buffering)
  const playbackRate = usePlayerStore((s) => s.playbackRate)
  const currentLevel = usePlayerStore((s) => s.currentLevel)
  const availableLevels = usePlayerStore((s) => s.availableLevels)
  const controlsVisible = usePlayerStore((s) => s.controlsVisible)
  const isFullscreen = usePlayerStore((s) => s.isFullscreen)
  const isPiP = usePlayerStore((s) => s.isPiP)
  const showSettings = usePlayerStore((s) => s.showSettings)
  const showQualitySelector = usePlayerStore((s) => s.showQualitySelector)

  // --- Store actions ---
  const setPlaying = usePlayerStore((s) => s.setPlaying)
  const setMuted = usePlayerStore((s) => s.setMuted)
  const setVolume = usePlayerStore((s) => s.setVolume)
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime)
  const setDuration = usePlayerStore((s) => s.setDuration)
  const setBuffering = usePlayerStore((s) => s.setBuffering)
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate)
  const setCurrentLevel = usePlayerStore((s) => s.setCurrentLevel)
  const setAvailableLevels = usePlayerStore((s) => s.setAvailableLevels)
  const setControlsVisible = usePlayerStore((s) => s.setControlsVisible)
  const setFullscreen = usePlayerStore((s) => s.setFullscreen)
  const setPiP = usePlayerStore((s) => s.setPiP)
  const setShowSettings = usePlayerStore((s) => s.setShowSettings)
  const setShowQualitySelector = usePlayerStore((s) => s.setShowQualitySelector)
  const togglePlay = usePlayerStore((s) => s.togglePlay)
  const toggleMute = usePlayerStore((s) => s.toggleMute)
  const toggleSettings = usePlayerStore((s) => s.toggleSettings)
  const toggleQualitySelector = usePlayerStore((s) => s.toggleQualitySelector)
  const reset = usePlayerStore((s) => s.reset)

  // --- Local (non-store) state ---
  const [streamUrl, setStreamUrl] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [retryCount, setRetryCount] = React.useState(0)

  const { isFavorite, toggleFavorite } = useFavorites()
  const favorited = isFavorite(channel.id)

  // Reset store + local state on channel change / mount.
  React.useEffect(() => {
    reset()
    setLoading(true)
    setError(null)
    setStreamUrl(null)
  }, [channel.id, reset])

  // Resolve the streamUrl. If the channel already carries one, use it;
  // otherwise fetch /api/channels/[id] (which includes streamUrl).
  React.useEffect(() => {
    let cancelled = false
    async function run() {
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
    // channel.id is the stable identity; `channel` is captured in the closure.
    // retryCount lets the Retry button re-trigger the fetch.
  }, [channel.id, retryCount])

  // Set up hls.js when streamUrl is available.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video || !streamUrl) return

    let disposed = false
    setLoading(true)
    setError(null)

    // Safari path: native HLS.
    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
        const onLoaded = () => {
          if (disposed) return
          setLoading(false)
          const p = video.play()
          if (p && typeof p.then === 'function') {
            p.then(() => setPlaying(true)).catch(() => setPlaying(false))
          }
        }
        const onError = () => {
          if (disposed) return
          setError('Unable to load this stream on your device.')
          setLoading(false)
        }
        video.addEventListener('loadedmetadata', onLoaded)
        video.addEventListener('error', onError)
        return () => {
          disposed = true
          video.removeEventListener('loadedmetadata', onLoaded)
          video.removeEventListener('error', onError)
          video.pause()
          video.removeAttribute('src')
          video.load()
        }
      }
      // Neither hls.js nor native HLS.
      setError('Your browser does not support HLS playback.')
      setLoading(false)
      return
    }

    // Standard path: hls.js.
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: 30,
      startLevel: currentLevel,
    })
    hlsRef.current = hls

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (disposed) return
      setLoading(false)
      const levels: QualityLevel[] = hls.levels.map((lvl, idx) => ({
        index: idx,
        height: lvl.height || 0,
        width: lvl.width || 0,
        bitrate: lvl.bitrate || 0,
        label: levelLabel(lvl.height),
      }))
      setAvailableLevels(levels)
      const p = video.play()
      if (p && typeof p.then === 'function') {
        p.then(() => setPlaying(true)).catch(() => setPlaying(false))
      }
    })

    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      if (disposed) return
      const level = (data as { level: number }).level
      setCurrentLevel(level)
    })

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (disposed) return
      const errorData = data as { fatal: boolean; details?: string }
      if (errorData.fatal) {
        setError(
          errorData.details
            ? `Stream error: ${errorData.details}`
            : 'This stream is currently unavailable.',
        )
        setLoading(false)
        try {
          hls.destroy()
        } catch {
          // ignore
        }
      }
    })

    hls.on(Hls.Events.FRAG_LOADING, () => {
      if (disposed) return
      setBuffering(true)
    })
    hls.on(Hls.Events.FRAG_LOADED, () => {
      if (disposed) return
      setBuffering(false)
    })

    hls.loadSource(streamUrl)
    hls.attachMedia(video)

    return () => {
      disposed = true
      try {
        hls.destroy()
      } catch {
        // ignore
      }
      hlsRef.current = null
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    // We intentionally only re-run on streamUrl change so toggling quality
    // (currentLevel) doesn't tear down the Hls instance. The separate
    // effect below applies currentLevel changes to the existing instance.
  }, [streamUrl])

  // Apply currentLevel changes to the existing Hls instance.
  React.useEffect(() => {
    const hls = hlsRef.current
    if (!hls) return
    if (hls.currentLevel !== currentLevel) {
      hls.currentLevel = currentLevel
    }
  }, [currentLevel])

  // Video event listeners -> sync to store.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTimeUpdate = () => setCurrentTime(video.currentTime)
    const onDurationChange = () => setDuration(video.duration)
    const onVolumeChange = () => {
      setMuted(video.muted)
      setVolume(video.volume)
    }
    const onWaiting = () => setBuffering(true)
    const onPlaying = () => setBuffering(false)
    const onCanPlay = () => setBuffering(false)

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('volumechange', onVolumeChange)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('playing', onPlaying)
    video.addEventListener('canplay', onCanPlay)

    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('volumechange', onVolumeChange)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('canplay', onCanPlay)
    }
  }, [
    streamUrl,
    setPlaying,
    setCurrentTime,
    setDuration,
    setMuted,
    setVolume,
    setBuffering,
  ])

  // Apply isPlaying from store -> video.play() / video.pause().
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying && video.paused) {
      const p = video.play()
      if (p && typeof p.then === 'function') {
        p.then(() => setPlaying(true)).catch(() => setPlaying(false))
      }
    } else if (!isPlaying && !video.paused) {
      video.pause()
    }
  }, [isPlaying, setPlaying])

  // Apply volume from store -> video.volume.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (Math.abs(video.volume - volume) > 0.001) {
      video.volume = volume
    }
  }, [volume])

  // Apply isMuted from store -> video.muted.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (video.muted !== isMuted) {
      video.muted = isMuted
    }
  }, [isMuted])

  // Apply playbackRate from store -> video.playbackRate.
  React.useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (video.playbackRate !== playbackRate) {
      video.playbackRate = playbackRate
    }
  }, [playbackRate])

  // Fullscreen change listener.
  React.useEffect(() => {
    function onFsChange() {
      setFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [setFullscreen])

  // PiP change listener.
  React.useEffect(() => {
    function onPipChange() {
      setPiP(!!document.pictureInPictureElement)
    }
    document.addEventListener('enterpictureinpicture', onPipChange)
    document.addEventListener('leavepictureinpicture', onPipChange)
    return () => {
      document.removeEventListener('enterpictureinpicture', onPipChange)
      document.removeEventListener('leavepictureinpicture', onPipChange)
    }
  }, [setPiP])

  // Lock body scroll while the player is open.
  React.useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  // Watch history: POST every 30s while playing.
  React.useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => {
      const video = videoRef.current
      if (!video || video.currentTime < 5) return
      void fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: channel.id,
          durationSeconds: Math.floor(video.currentTime),
        }),
      }).catch(() => {
        // Network failure - swallow; the next tick will retry.
      })
    }, 30000)
    return () => window.clearInterval(id)
  }, [isPlaying, channel.id])

  // Watch history: POST on unmount if currentTime > 5. Uses sendBeacon
  // so it fires even if the page is closing.
  React.useEffect(() => {
    return () => {
      const video = videoRef.current
      if (!video) return
      if (video.currentTime < 5) return
      const payload = JSON.stringify({
        channelId: channel.id,
        durationSeconds: Math.floor(video.currentTime),
      })
      try {
        const blob = new Blob([payload], { type: 'application/json' })
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          if (navigator.sendBeacon('/api/history', blob)) return
        }
      } catch {
        // ignore - fall through to fetch
      }
      void fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // ignore
      })
    }
  }, [channel.id])

  // --- Auto-hide controls ---
  // When playing + visible + settings closed, start a 5s timer to hide.
  // `resetCounter` lets us restart the timer on any interaction.
  const [resetCounter, setResetCounter] = React.useState(0)
  React.useEffect(() => {
    if (!isPlaying || !controlsVisible || showSettings) return
    const id = window.setTimeout(() => {
      setControlsVisible(false)
    }, 5000)
    return () => window.clearTimeout(id)
  }, [isPlaying, controlsVisible, showSettings, setControlsVisible, resetCounter])

  const showControls = React.useCallback(() => {
    setControlsVisible(true)
    setResetCounter((c) => c + 1)
  }, [setControlsVisible])

  // Any keydown also shows controls (the remote hook handles specific keys).
  React.useEffect(() => {
    function onAnyKey() {
      showControls()
    }
    document.addEventListener('keydown', onAnyKey)
    return () => document.removeEventListener('keydown', onAnyKey)
  }, [showControls])

  // --- Handlers ---
  const handleToggleFullscreen = React.useCallback(() => {
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
  }, [])

  const handleTogglePiP = React.useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    if (typeof document === 'undefined' || !document.pictureInPictureEnabled)
      return
    if (typeof video.requestPictureInPicture !== 'function') return
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else {
        await video.requestPictureInPicture()
      }
    } catch {
      // PiP denied. Silently ignore.
    }
  }, [])

  const handleSeek = React.useCallback(
    (time: number) => {
      const video = videoRef.current
      if (!video) return
      if (!Number.isFinite(time)) return
      const maxTime = Number.isFinite(video.duration) ? video.duration : time
      const clamped = Math.max(0, Math.min(time, maxTime))
      video.currentTime = clamped
      setCurrentTime(clamped)
    },
    [setCurrentTime],
  )

  const handleSetQuality = React.useCallback(
    (level: number) => {
      setCurrentLevel(level)
      setShowQualitySelector(false)
    },
    [setCurrentLevel, setShowQualitySelector],
  )

  const handleRetry = React.useCallback(() => {
    setError(null)
    setLoading(true)
    setStreamUrl(null)
    setRetryCount((c) => c + 1)
  }, [])

  const handleClose = React.useCallback(() => {
    onBack?.()
  }, [onBack])

  // --- Smart TV remote control ---
  useRemoteControl({
    enabled: true,
    onEnter: () => {
      // Enter toggles play if no interactive element is focused.
      const active = document.activeElement as HTMLElement | null
      if (
        !active ||
        active === document.body ||
        active.tagName === 'VIDEO' ||
        active === containerRef.current
      ) {
        togglePlay()
        return
      }
      if (typeof active.click === 'function') {
        active.click()
      }
    },
    onBack: () => {
      if (showSettings) setShowSettings(false)
      else if (showQualitySelector) setShowQualitySelector(false)
      else handleClose()
    },
    onArrowUp: () => setVolume(Math.min(1, volume + 0.1)),
    onArrowDown: () => setVolume(Math.max(0, volume - 0.1)),
    onArrowLeft: () => handleSeek(currentTime - 10),
    onArrowRight: () => handleSeek(currentTime + 10),
    onTogglePlay: togglePlay,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onVolumeUp: () => setVolume(Math.min(1, volume + 0.1)),
    onVolumeDown: () => setVolume(Math.max(0, volume - 0.1)),
    onMute: toggleMute,
    onFullscreen: handleToggleFullscreen,
    onNumber: (n) => {
      // Seek to N% of duration (0=0%, 9=90%, etc.).
      const video = videoRef.current
      if (!video) return
      if (!Number.isFinite(video.duration)) return
      handleSeek((n / 10) * video.duration)
    },
    focusSelector: '.player-focusable',
    focusContainer: containerRef,
  })

  const showLoading = loading && !error
  const showError = !!error
  const showBuffering = buffering && !loading && !error
  const showCenterPlay = !loading && !error && !isPlaying

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onMouseMove={showControls}
      onClick={showControls}
      role="dialog"
      aria-modal="true"
      aria-label={`Now playing ${channel.name}`}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        playsInline
        aria-label={`${channel.name} live stream`}
        onClick={(e) => {
          e.stopPropagation()
          togglePlay()
        }}
      />

      {/* Loading state */}
      {showLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white pointer-events-none">
          <Loader2 className="h-12 w-12 animate-spin" aria-hidden />
          <span className="text-sm text-white/80">Loading stream…</span>
        </div>
      ) : null}

      {/* Error state */}
      {showError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
          <AlertCircle className="h-12 w-12 text-red-400" aria-hidden />
          <p className="text-lg font-medium">
            This stream is currently unavailable
          </p>
          <p className="text-sm text-white/70 max-w-md">{error}</p>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={handleRetry}
              className="player-focusable inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors focus-ring min-h-[44px]"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="player-focusable px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors focus-ring min-h-[44px]"
            >
              Go back
            </button>
          </div>
        </div>
      ) : null}

      {/* Buffering spinner overlay (non-blocking) */}
      {showBuffering ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Loader2
            className="h-10 w-10 animate-spin text-white/80"
            aria-hidden
          />
        </div>
      ) : null}

      {/* Top bar */}
      {controlsVisible && !showError ? (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Back"
              onClick={handleClose}
              className="player-focusable p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <ChannelLogo channel={channel} />
            <div className="min-w-0">
              <h2 className="text-white font-semibold text-sm sm:text-base truncate">
                {channel.name}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
                {channel.category ? (
                  <span className="text-white/60 text-xs uppercase tracking-wider truncate">
                    {channel.category}
                  </span>
                ) : null}
              </div>
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
              className="player-focusable p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <Heart
                className={cn(
                  'h-5 w-5',
                  favorited ? 'fill-red-500 text-red-500' : 'text-white',
                )}
              />
            </button>
            <button
              type="button"
              aria-label="Close player"
              onClick={handleClose}
              className="player-focusable p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Center play button when paused */}
      {controlsVisible && showCenterPlay ? (
        <button
          type="button"
          aria-label="Play"
          onClick={togglePlay}
          className="player-focusable absolute inset-0 m-auto h-16 w-16 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm flex items-center justify-center focus-ring transition-colors z-10"
        >
          <Play className="h-8 w-8 text-white fill-white ml-1" />
        </button>
      ) : null}

      {/* Bottom controls */}
      {!showError ? (
        <PlayerControls
          visible={controlsVisible}
          isPlaying={isPlaying}
          isMuted={isMuted}
          volume={volume}
          currentTime={currentTime}
          duration={duration}
          buffering={buffering}
          playbackRate={playbackRate}
          currentLevel={currentLevel}
          availableLevels={availableLevels}
          isFullscreen={isFullscreen}
          isPiP={isPiP}
          showSettings={showSettings}
          showQualitySelector={showQualitySelector}
          onTogglePlay={togglePlay}
          onToggleMute={toggleMute}
          onSetVolume={setVolume}
          onSeek={handleSeek}
          onSetPlaybackRate={setPlaybackRate}
          onSetQuality={handleSetQuality}
          onToggleFullscreen={handleToggleFullscreen}
          onTogglePiP={handleTogglePiP}
          onToggleSettings={toggleSettings}
          onToggleQualitySelector={toggleQualitySelector}
        />
      ) : null}

      {/* Settings modal */}
      <PlayerSettings
        visible={showSettings}
        availableLevels={availableLevels}
        currentLevel={currentLevel}
        playbackRate={playbackRate}
        volume={volume}
        isMuted={isMuted}
        onSetQuality={handleSetQuality}
        onSetPlaybackRate={setPlaybackRate}
        onSetVolume={setVolume}
        onToggleMute={toggleMute}
        onClose={() => setShowSettings(false)}
      />
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
