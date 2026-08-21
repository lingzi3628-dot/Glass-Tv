'use client'

import * as React from 'react'
import {
  ChevronUp,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture,
  Play,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type { QualityLevel } from '@/lib/store/player-store'

/**
 * PlayerControls
 *
 * Bottom control bar rendered above the Player's video element. Composed of:
 *
 *   - Seek bar (or LIVE badge for live streams)
 *   - Left cluster: Play/Pause, Mute, Volume slider, time display
 *   - Right cluster: Playback rate (cycles 0.5->2), Quality selector with
 *     dropdown, Picture-in-Picture, Fullscreen, Settings
 *
 * Returns null when `visible === false` so the whole bar (and its focusable
 * children) hide during auto-hide.
 */

export interface PlayerControlsProps {
  visible: boolean
  isPlaying: boolean
  isMuted: boolean
  volume: number
  currentTime: number
  duration: number
  buffering: boolean
  playbackRate: number
  currentLevel: number
  availableLevels: QualityLevel[]
  isFullscreen: boolean
  isPiP: boolean
  showSettings: boolean
  showQualitySelector: boolean
  onTogglePlay: () => void
  onToggleMute: () => void
  onSetVolume: (v: number) => void
  onSeek: (time: number) => void
  onSetPlaybackRate: (rate: number) => void
  onSetQuality: (level: number) => void
  onToggleFullscreen: () => void
  onTogglePiP: () => void
  onToggleSettings: () => void
  onToggleQualitySelector: () => void
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Live streams report duration = Infinity, or a very large finite number
 * (HLS DVR window). Treat anything non-finite, <= 0, or > 24h as live and
 * hide the seek bar.
 */
function isLiveDuration(duration: number): boolean {
  if (!Number.isFinite(duration)) return true
  if (duration <= 0) return true
  if (duration > 86400) return true
  return false
}

export function PlayerControls(props: PlayerControlsProps) {
  const {
    visible,
    isPlaying,
    isMuted,
    volume,
    currentTime,
    duration,
    buffering,
    playbackRate,
    currentLevel,
    availableLevels,
    isFullscreen,
    isPiP,
    showSettings,
    showQualitySelector,
    onTogglePlay,
    onToggleMute,
    onSetVolume,
    onSeek,
    onSetPlaybackRate,
    onSetQuality,
    onToggleFullscreen,
    onTogglePiP,
    onToggleSettings,
    onToggleQualitySelector,
  } = props

  const live = isLiveDuration(duration)
  const progress = live ? 0 : duration > 0 ? (currentTime / duration) * 100 : 0
  const effectiveVolume = isMuted ? 0 : volume
  const currentLevelObj = availableLevels.find((l) => l.index === currentLevel)
  const qualityButtonLabel =
    currentLevel === -1 ? 'Auto' : currentLevelObj?.label ?? 'Quality'

  const seekBarRef = React.useRef<HTMLDivElement>(null)
  const [isScrubbing, setIsScrubbing] = React.useState(false)
  const qualityWrapRef = React.useRef<HTMLDivElement>(null)

  // Close the quality dropdown when clicking outside of it.
  React.useEffect(() => {
    if (!showQualitySelector) return
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (!qualityWrapRef.current?.contains(target)) {
        // Close by calling the toggle (which currently is open -> will close).
        onToggleQualitySelector()
      }
    }
    // Defer registration so the click that opened the dropdown doesn't
    // immediately close it (the open click's mousedown already fired).
    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocClick)
    }, 0)
    return () => {
      window.clearTimeout(id)
      document.removeEventListener('mousedown', onDocClick)
    }
  }, [showQualitySelector, onToggleQualitySelector])

  function seekFromClientX(clientX: number) {
    if (live) return
    const rect = seekBarRef.current?.getBoundingClientRect()
    if (!rect) return
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    onSeek(ratio * duration)
  }

  function handleSeekBarClick(e: React.MouseEvent<HTMLDivElement>) {
    seekFromClientX(e.clientX)
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (live) return
    setIsScrubbing(true)
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Some browsers throw if pointerId is invalid; ignore.
    }
    seekFromClientX(e.clientX)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isScrubbing) return
    seekFromClientX(e.clientX)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isScrubbing) return
    setIsScrubbing(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  if (!visible) return null

  const btnBase =
    'player-focusable p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center'

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 px-3 sm:px-6 pb-3 sm:pb-5 pt-12 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
      {/* Seek bar / LIVE badge */}
      <div className="mb-2 flex items-center gap-3">
        {live ? (
          <div className="flex items-center gap-2 text-white py-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">
              Live
            </span>
          </div>
        ) : (
          <div
            ref={seekBarRef}
            className="group relative flex-1 h-3 flex items-center cursor-pointer touch-none"
            onClick={handleSeekBarClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            role="slider"
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            tabIndex={-1}
          >
            <div className="relative w-full h-1.5 bg-white/25 rounded-full">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-secondary rounded-full"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Buttons row */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
        {/* Left cluster */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            aria-pressed={isPlaying}
            onClick={onTogglePlay}
            className={btnBase}
          >
            {isPlaying ? (
              <Pause className="h-5 w-5" />
            ) : (
              <Play className="h-5 w-5 fill-white" />
            )}
          </button>
          <button
            type="button"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            aria-pressed={isMuted}
            onClick={onToggleMute}
            className={btnBase}
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={effectiveVolume}
            onChange={(e) => onSetVolume(parseFloat(e.target.value))}
            aria-label="Volume"
            className="player-focusable hidden sm:block w-24 h-1.5 cursor-pointer"
            style={{
              background: `linear-gradient(to right, white 0%, white ${
                effectiveVolume * 100
              }%, rgba(255,255,255,0.3) ${
                effectiveVolume * 100
              }%, rgba(255,255,255,0.3) 100%)`,
              borderRadius: '9999px',
              appearance: 'none',
              WebkitAppearance: 'none',
            }}
          />
          <div className="text-white text-xs sm:text-sm tabular-nums ml-1 select-none min-w-[88px]">
            {live ? (
              <span className="font-medium text-red-500">LIVE</span>
            ) : (
              <span>
                {formatTime(currentTime)}{' '}
                <span className="text-white/50">/</span>{' '}
                {formatTime(duration)}
              </span>
            )}
          </div>
          {buffering ? (
            <span className="ml-2 text-xs text-white/60 hidden sm:inline">
              Buffering…
            </span>
          ) : null}
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Playback rate (cycle on click) */}
          <button
            type="button"
            aria-label={`Playback speed: ${playbackRate}x. Click to cycle.`}
            onClick={() => {
              const idx = PLAYBACK_RATES.indexOf(playbackRate)
              const next =
                PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length]
              onSetPlaybackRate(next)
            }}
            className="player-focusable px-2.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium transition-colors focus-ring min-h-[44px] min-w-[44px]"
          >
            {playbackRate}&times;
          </button>

          {/* Quality selector + dropdown */}
          <div ref={qualityWrapRef} className="relative">
            <button
              type="button"
              aria-label={`Quality: ${qualityButtonLabel}. Click to change.`}
              aria-expanded={showQualitySelector}
              aria-pressed={showQualitySelector}
              onClick={onToggleQualitySelector}
              className="player-focusable px-2.5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-medium transition-colors focus-ring flex items-center gap-1 min-h-[44px]"
            >
              <span>{qualityButtonLabel}</span>
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            {showQualitySelector ? (
              <div className="absolute bottom-full mb-2 right-0 glass-dark rounded-xl p-1 min-w-[200px] max-h-72 overflow-y-auto scrollbar-premium animate-fade-in">
                <button
                  type="button"
                  aria-pressed={currentLevel === -1}
                  onClick={() => {
                    onSetQuality(-1)
                    onToggleQualitySelector()
                  }}
                  className={cn(
                    'player-focusable w-full text-left px-3 py-2 text-sm rounded-lg transition-colors focus-ring whitespace-nowrap min-h-[40px]',
                    currentLevel === -1
                      ? 'bg-primary/30 text-primary font-medium'
                      : 'text-white/80 hover:bg-white/10',
                  )}
                >
                  Auto
                </button>
                {availableLevels.map((level) => {
                  const active = currentLevel === level.index
                  return (
                    <button
                      key={level.index}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        onSetQuality(level.index)
                        onToggleQualitySelector()
                      }}
                      className={cn(
                        'player-focusable w-full text-left px-3 py-2 text-sm rounded-lg transition-colors focus-ring whitespace-nowrap min-h-[40px]',
                        active
                          ? 'bg-primary/30 text-primary font-medium'
                          : 'text-white/80 hover:bg-white/10',
                      )}
                    >
                      {level.label} &middot; {Math.round(level.bitrate / 1000)}{' '}
                      kbps
                    </button>
                  )
                })}
                {availableLevels.length === 0 ? (
                  <p className="text-xs text-white/50 px-3 py-2">
                    No alternate levels.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* PiP */}
          <button
            type="button"
            aria-label={
              isPiP
                ? 'Exit picture-in-picture'
                : 'Enter picture-in-picture'
            }
            aria-pressed={isPiP}
            onClick={onTogglePiP}
            className={btnBase}
          >
            <PictureInPicture className="h-5 w-5" />
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            aria-pressed={isFullscreen}
            onClick={onToggleFullscreen}
            className={btnBase}
          >
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>

          {/* Settings */}
          <button
            type="button"
            aria-label="Settings"
            aria-pressed={showSettings}
            onClick={onToggleSettings}
            className={btnBase}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
