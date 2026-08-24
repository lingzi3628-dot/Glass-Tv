'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Hls from 'hls.js'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  ListVideo,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store/app-store'
import type { ShortDramaEpisode } from '@/lib/short-drama/service'

// ─────────────────────────────────────────────────────────────────────
// API response shapes
// ─────────────────────────────────────────────────────────────────────

interface EpisodesResponse {
  episodes?: ShortDramaEpisode[]
  totalEpisodes?: number
  error?: string
}

interface StreamResponse {
  streamUrl?: string
  episode?: ShortDramaEpisode
  error?: string
}

interface HistoryPostResponse {
  success?: boolean
  error?: string
}

// ─────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────

const AUTO_HIDE_MS = 3500
const SWIPE_THRESHOLD = 60 // px vertical travel to count as a swipe

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

export function ShortDramaPlayer() {
  const player = useAppStore((s) => s.shortDramaPlayer)
  const closeShortDramaPlayer = useAppStore((s) => s.closeShortDramaPlayer)

  const videoRef = React.useRef<HTMLVideoElement>(null)
  const hlsRef = React.useRef<Hls | null>(null)

  // Local episode/URL state — initialized from the store but updated as
  // the user swipes between episodes. We don't push these back to the
  // global store (the store only seeds the initial open).
  const [episodeNumber, setEpisodeNumber] = React.useState<number>(1)
  const [streamUrl, setStreamUrl] = React.useState<string>('')
  const [episodes, setEpisodes] = React.useState<ShortDramaEpisode[]>([])

  const [isPlaying, setIsPlaying] = React.useState(false)
  const [isMuted, setIsMuted] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [controlsVisible, setControlsVisible] = React.useState(true)
  const [showEpisodeList, setShowEpisodeList] = React.useState(false)
  const [liked, setLiked] = React.useState(false)

  // Reset local state whenever the global player opens a NEW drama.
  React.useEffect(() => {
    if (!player) return
    setEpisodeNumber(player.episodeNumber)
    setStreamUrl(player.streamUrl)
    setEpisodes([])
    setIsPlaying(false)
    setIsMuted(false)
    setCurrentTime(0)
    setDuration(0)
    setIsLoading(true)
    setError(null)
    setLiked(false)
    setShowEpisodeList(false)
    setControlsVisible(true)
  }, [player?.dramaId, player?.episodeNumber])

  // Preload the full episode list once the player opens — used by the
  // episode-list popover and by the next/prev swipe handlers.
  React.useEffect(() => {
    if (!player) return
    let cancelled = false
    async function run() {
      if (!player) return
      try {
        const res = await fetch(
          `/api/short-drama?action=episodes&id=${encodeURIComponent(player.dramaId)}`,
        )
        const data = (await res.json()) as EpisodesResponse
        if (!cancelled && res.ok && data.episodes) {
          setEpisodes(data.episodes)
        }
      } catch {
        // ignore — next/prev handlers will fall back to ?action=stream
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [player])

  // Lock body scroll while the overlay is open.
  React.useEffect(() => {
    if (!player) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [player])

  // ── Helpers (declared before the effects that use them) ───────────
  // The react-hooks/immutability rule requires referenced functions to be
  // declared earlier in the component body, so we keep these above the
  // keyboard / onEnded effects below.

  function bumpControls() {
    setControlsVisible(true)
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      const p = video.play()
      if (p && typeof p.then === 'function') {
        p.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
      } else {
        setIsPlaying(true)
      }
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current
    if (!video) return
    const t = parseFloat(e.target.value)
    if (!Number.isFinite(t)) return
    video.currentTime = t
    setCurrentTime(t)
  }

  /** Switch to a different episode, updating local URL state. */
  async function changeEpisode(target: number) {
    if (!player) return
    if (target === episodeNumber) return

    // Try local cache first.
    const local = episodes.find((e) => e.episodeNumber === target)
    if (local) {
      setEpisodeNumber(target)
      setStreamUrl(local.streamUrl)
      return
    }

    // Fall back to API lookup.
    try {
      const res = await fetch(
        `/api/short-drama?action=stream&id=${encodeURIComponent(player.dramaId)}&episode=${target}`,
      )
      const data = (await res.json()) as StreamResponse
      if (res.ok && data.streamUrl) {
        setEpisodeNumber(target)
        setStreamUrl(data.streamUrl)
      }
    } catch {
      // ignore — user stays on current episode
    }
  }

  // ── Video source attach / detach ──────────────────────────────────
  // Capture the video element as `v` (non-null) before any closure
  // touches it so TypeScript can prove it receives an HTMLVideoElement.
  React.useEffect(() => {
    if (!player) return
    const video = videoRef.current
    if (!video || !streamUrl) return
    const v = video // captured non-null ref for closures

    let disposed = false
    setIsLoading(true)
    setError(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)

    // ── .mp4 files: use native <video> playback (NOT hls.js) ──────
    // hls.js only works with .m3u8 HLS manifests. Feeding it a .mp4 URL
    // causes manifestLoadError. For .mp4 we set video.src directly.
    const isMp4 = streamUrl.endsWith('.mp4') || streamUrl.includes('.mp4?')

    if (isMp4 || !Hls.isSupported()) {
      v.src = streamUrl
      v.muted = isMuted

      const onLoaded = () => {
        if (disposed) return
        setIsLoading(false)
        setDuration(Number.isFinite(v.duration) ? v.duration : 0)
        const p = v.play()
        if (p && typeof p.then === 'function') {
          p.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
        }
      }
      const onErr = () => {
        if (disposed) return
        setError('Unable to load this video. Try another episode.')
        setIsLoading(false)
      }
      v.addEventListener('loadedmetadata', onLoaded)
      v.addEventListener('error', onErr)

      // Kick off loading
      v.load()

      return () => {
        disposed = true
        v.removeEventListener('loadedmetadata', onLoaded)
        v.removeEventListener('error', onErr)
        v.pause()
        v.removeAttribute('src')
        v.load()
      }
    }

    // ── .m3u8 HLS streams: use hls.js ─────────────────────────────
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      maxBufferLength: 5,
    })
    hlsRef.current = hls

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (disposed) return
      setIsLoading(false)
      const p = v.play()
      if (p && typeof p.then === 'function') {
        p.then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
      }
    })

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (disposed) return
      if (data.fatal) {
        setError(
          data.details
            ? `Stream error: ${data.details}`
            : 'This episode is currently unavailable.',
        )
        setIsLoading(false)
        try {
          hls.destroy()
        } catch {
          // ignore
        }
      }
    })

    hls.loadSource(streamUrl)
    hls.attachMedia(v)

    return () => {
      disposed = true
      try {
        hls.destroy()
      } catch {
        // ignore
      }
      hlsRef.current = null
      v.pause()
      v.removeAttribute('src')
      v.load()
    }
    // We deliberately only re-attach when streamUrl or player changes —
    // toggling play/mute should NOT re-create the Hls instance.
  }, [streamUrl, player])

  // Sync play/pause + timeupdate + durationchange events.
  React.useEffect(() => {
    if (!player) return
    const video = videoRef.current
    if (!video) return
    const v = video

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onTime = () => setCurrentTime(v.currentTime)
    const onDur = () =>
      setDuration(Number.isFinite(v.duration) ? v.duration : 0)

    v.addEventListener('play', onPlay)
    v.addEventListener('playing', onPlay)
    v.addEventListener('pause', onPause)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('durationchange', onDur)
    v.addEventListener('loadedmetadata', onDur)
    return () => {
      v.removeEventListener('play', onPlay)
      v.removeEventListener('playing', onPlay)
      v.removeEventListener('pause', onPause)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('durationchange', onDur)
      v.removeEventListener('loadedmetadata', onDur)
    }
  }, [streamUrl, player])

  // Auto-play next episode when current ends.
  React.useEffect(() => {
    if (!player) return
    const video = videoRef.current
    if (!video) return
    const v = video
    const onEnded = () => {
      // Record completed history.
      void recordHistory(player.dramaId, episodeNumber, Math.floor(v.currentTime), true)
      const next = episodeNumber + 1
      if (next <= player.totalEpisodes) {
        void changeEpisode(next)
      } else {
        setIsPlaying(false)
      }
    }
    v.addEventListener('ended', onEnded)
    return () => v.removeEventListener('ended', onEnded)
  }, [player, episodeNumber])

  // Record history on unmount / episode change (best-effort).
  React.useEffect(() => {
    if (!player) return
    // Record a "started watching" entry.
    void recordHistory(player.dramaId, episodeNumber, 0, false)
  }, [episodeNumber, player?.dramaId])

  // ── Auto-hide controls ────────────────────────────────────────────
  React.useEffect(() => {
    if (!player) return
    if (!controlsVisible) return
    if (showEpisodeList) return // keep visible while popover is open
    const t = window.setTimeout(() => setControlsVisible(false), AUTO_HIDE_MS)
    return () => window.clearTimeout(t)
  }, [player, controlsVisible, showEpisodeList, currentTime])

  // Keyboard: Escape closes; arrow up/down changes episodes; space toggles play.
  React.useEffect(() => {
    if (!player) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeShortDramaPlayer()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        bumpControls()
        if (episodeNumber < player!.totalEpisodes) void changeEpisode(episodeNumber + 1)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        bumpControls()
        if (episodeNumber > 1) void changeEpisode(episodeNumber - 1)
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        bumpControls()
        togglePlay()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [player, episodeNumber])

  // ── Touch swipe handlers (vertical swipe → next/prev episode) ──────
  const touchStart = React.useRef<{ x: number; y: number; t: number } | null>(null)

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const t = e.touches[0]
    if (!t) return
    touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() }
  }

  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || !player) return
    const end = e.changedTouches[0]
    if (!end) return
    const dy = end.clientY - start.y
    const dx = end.clientX - start.x
    const elapsed = Date.now() - start.t
    // Only count predominantly-vertical swipes that are quick enough
    // to be intentional (and longer than the threshold).
    if (Math.abs(dy) >= SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) * 1.5 && elapsed < 800) {
      if (dy < 0) {
        // Swipe up → next episode
        if (episodeNumber < player.totalEpisodes) void changeEpisode(episodeNumber + 1)
      } else {
        // Swipe down → previous episode
        if (episodeNumber > 1) void changeEpisode(episodeNumber - 1)
      }
    }
  }

  function handleContainerClick() {
    // Tap toggles controls visibility.
    setControlsVisible((v) => !v)
  }

  if (!player) return null

  const totalEpisodes = player.totalEpisodes
  const dramaTitle = player.dramaTitle
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <AnimatePresence>
      <motion.div
        key="short-drama-player"
        className="fixed inset-0 z-[60] bg-black flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        role="dialog"
        aria-modal="true"
        aria-label={`Playing ${dramaTitle}, episode ${episodeNumber} of ${totalEpisodes}`}
      >
        {/* Video stage — 9:16, capped to viewport height + max width */}
        <div
          className={cn(
            'relative h-full w-full max-w-md mx-auto',
            'flex items-center justify-center',
          )}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleContainerClick}
        >
          <div className="relative h-full w-full bg-black">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-contain bg-black"
              playsInline
              aria-label={`${dramaTitle} episode ${episodeNumber}`}
            />

            {/* Loading state */}
            {isLoading && !error ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="player-glass-loading px-6 py-5 flex flex-col items-center gap-3">
                  <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin" aria-hidden />
                  <span className="text-xs text-white/80">Loading episode…</span>
                </div>
              </div>
            ) : null}

            {/* Error state */}
            {error ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                <span className="text-5xl" aria-hidden>
                  📡
                </span>
                <p className="text-white font-medium">This episode is unavailable</p>
                <p className="text-white/70 text-sm max-w-xs">{error}</p>
                <button
                  type="button"
                  onClick={closeShortDramaPlayer}
                  className="player-glow-btn mt-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
                >
                  Go back
                </button>
              </div>
            ) : null}

            {/* Center play/pause indicator (when paused, not loading) */}
            <AnimatePresence>
              {!isPlaying && !isLoading && !error && controlsVisible ? (
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePlay()
                  }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="player-glow-btn-primary absolute inset-0 m-auto h-16 w-16 rounded-full flex items-center justify-center text-white"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  <Play className="h-7 w-7 fill-current translate-x-0.5" aria-hidden />
                </motion.button>
              ) : null}
            </AnimatePresence>

            {/* ── Top bar ─────────────────────────────────────────── */}
            <AnimatePresence>
              {controlsVisible ? (
                <motion.div
                  key="top-bar"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.18 }}
                  className="player-glass-controls absolute top-0 left-0 right-0 z-30 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        closeShortDramaPlayer()
                      }}
                      aria-label="Close player"
                      className="player-glow-btn p-2 rounded-full text-white"
                    >
                      <ChevronDown className="h-5 w-5" aria-hidden />
                    </button>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate max-w-[180px] sm:max-w-[240px]">
                        {dramaTitle}
                      </p>
                      <p className="text-white/70 text-[11px]">
                        Episode {episodeNumber} of {totalEpisodes}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowEpisodeList((v) => !v)
                    }}
                    aria-label="Episode list"
                    aria-expanded={showEpisodeList}
                    className="player-glow-btn p-2 rounded-full text-white"
                  >
                    <ListVideo className="h-5 w-5" aria-hidden />
                  </button>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* ── Episode list popover ────────────────────────────── */}
            <AnimatePresence>
              {showEpisodeList && controlsVisible ? (
                <motion.div
                  key="ep-list"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="player-glass-panel absolute top-16 right-3 z-40 w-64 max-h-[60vh] overflow-y-auto p-2"
                >
                  <p className="px-2 pt-1 pb-2 text-xs uppercase tracking-wider text-white/60 font-semibold">
                    Episodes
                  </p>
                  <div className="space-y-1">
                    {episodes.length > 0
                      ? episodes.map((ep) => {
                          const active = ep.episodeNumber === episodeNumber
                          return (
                            <button
                              key={ep.episodeNumber}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                void changeEpisode(ep.episodeNumber)
                                setShowEpisodeList(false)
                              }}
                              className={cn(
                                'w-full text-left px-2.5 py-2 rounded-lg transition-colors',
                                active
                                  ? 'bg-white/15 text-white'
                                  : 'text-white/80 hover:bg-white/10',
                              )}
                            >
                              <p className="text-xs font-semibold truncate">
                                {ep.episodeNumber}. {ep.title ?? 'Untitled'}
                              </p>
                              {active ? (
                                <p className="text-[10px] text-white/60 mt-0.5">
                                  Now playing
                                </p>
                              ) : null}
                            </button>
                          )
                        })
                      : Array.from({ length: totalEpisodes }).map((_, i) => {
                          const n = i + 1
                          const active = n === episodeNumber
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                void changeEpisode(n)
                                setShowEpisodeList(false)
                              }}
                              className={cn(
                                'w-full text-left px-2.5 py-2 rounded-lg transition-colors',
                                active
                                  ? 'bg-white/15 text-white'
                                  : 'text-white/80 hover:bg-white/10',
                              )}
                            >
                              <p className="text-xs font-semibold">
                                Episode {n}
                              </p>
                              {active ? (
                                <p className="text-[10px] text-white/60 mt-0.5">
                                  Now playing
                                </p>
                              ) : null}
                            </button>
                          )
                        })}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* ── Right TikTok action rail ───────────────────────── */}
            <AnimatePresence>
              {controlsVisible ? (
                <motion.div
                  key="action-rail"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-3 bottom-28 z-30 flex flex-col items-center gap-4"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setLiked((v) => !v)
                    }}
                    aria-label={liked ? 'Unlike' : 'Like'}
                    aria-pressed={liked}
                    className="flex flex-col items-center gap-1"
                  >
                    <span
                      className={cn(
                        'h-12 w-12 rounded-full flex items-center justify-center transition-all',
                        'player-glow-btn',
                      )}
                    >
                      <Heart
                        className={cn(
                          'h-6 w-6 transition-all',
                          liked
                            ? 'fill-red-500 text-red-500 scale-110'
                            : 'text-white',
                        )}
                        aria-hidden
                      />
                    </span>
                    <span className="text-[10px] font-semibold text-white">
                      {liked ? 'Liked' : 'Like'}
                    </span>
                  </button>

                  <div className="flex flex-col items-center gap-1">
                    <span className="h-12 w-12 rounded-full flex items-center justify-center player-glow-btn">
                      <span className="text-white text-sm font-bold">
                        {episodeNumber}
                        <span className="text-white/60">/{totalEpisodes}</span>
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold text-white">
                      Episode
                    </span>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* ── Bottom controls ─────────────────────────────────── */}
            <AnimatePresence>
              {controlsVisible ? (
                <motion.div
                  key="bottom-controls"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.18 }}
                  className="player-glass-controls absolute bottom-0 left-0 right-0 z-30 px-4 py-4 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Progress bar */}
                  <div className="flex items-center gap-2 text-[11px] text-white/80 font-mono">
                    <span className="tabular-nums w-9 text-right">
                      {formatTime(currentTime)}
                    </span>
                    <div className="relative flex-1 h-2 group">
                      <div className="absolute inset-0 rounded-full bg-white/20" />
                      <div
                        className="absolute left-0 top-0 bottom-0 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400"
                        style={{ width: `${progressPct}%` }}
                      />
                      <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        step={0.1}
                        value={Math.min(currentTime, duration || 0)}
                        onChange={handleSeek}
                        aria-label="Seek"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                    <span className="tabular-nums w-9">
                      {formatTime(duration)}
                    </span>
                  </div>

                  {/* Buttons row */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => void changeEpisode(episodeNumber - 1)}
                      disabled={episodeNumber <= 1}
                      aria-label="Previous episode"
                      className="player-glow-btn p-2.5 rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-5 w-5" aria-hidden />
                    </button>

                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      className="player-glow-btn-primary p-3 rounded-full text-white"
                    >
                      {isPlaying ? (
                        <Pause className="h-5 w-5 fill-current" aria-hidden />
                      ) : (
                        <Play className="h-5 w-5 fill-current translate-x-0.5" aria-hidden />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void changeEpisode(episodeNumber + 1)}
                      disabled={episodeNumber >= totalEpisodes}
                      aria-label="Next episode"
                      className="player-glow-btn p-2.5 rounded-full text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-5 w-5" aria-hidden />
                    </button>

                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Unmute' : 'Mute'}
                      className="player-glow-btn p-2.5 rounded-full text-white ml-2"
                    >
                      {isMuted ? (
                        <VolumeX className="h-5 w-5" aria-hidden />
                      ) : (
                        <Volume2 className="h-5 w-5" aria-hidden />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={closeShortDramaPlayer}
                      aria-label="Close player"
                      className="player-glow-btn p-2.5 rounded-full text-white ml-auto"
                    >
                      <X className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Fire-and-forget POST to /api/short-drama/history. Never throws. */
async function recordHistory(
  dramaId: string,
  episodeNumber: number,
  progress: number,
  completed: boolean,
): Promise<void> {
  try {
    const res = await fetch('/api/short-drama/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId: dramaId,
        episodeNumber,
        progress,
        completed,
      }),
    })
    const _data = (await res.json()) as HistoryPostResponse
    void _data
  } catch {
    // ignore — history is best-effort
  }
}
