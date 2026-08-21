'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Clock, Gauge, Languages, Volume2, VolumeX, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { QualityLevel } from '@/lib/store/player-store'

/**
 * PlayerSettings
 *
 * Centered modal overlay rendered on top of the Player when
 * `showSettings === true`. Click the backdrop to close. Contains three
 * sections: quality (Auto + each available hls.js level), playback speed
 * (3-col grid of [0.5, 0.75, 1, 1.25, 1.5, 2]), and volume (mute button +
 * range slider + percentage).
 *
 * Uses the `glass-dark` utility for the modal card.
 */
export interface PlayerSettingsProps {
  visible: boolean
  availableLevels: QualityLevel[]
  currentLevel: number
  playbackRate: number
  volume: number
  isMuted: boolean
  onSetQuality: (level: number) => void
  onSetPlaybackRate: (rate: number) => void
  onSetVolume: (v: number) => void
  onToggleMute: () => void
  onClose: () => void
  // Phase 4: captions settings
  captionsEnabled?: boolean
  captionsLanguage?: string
  captionFontSize?: number
  onToggleCaptions?: () => void
  onCaptionLanguageChange?: (lang: string) => void
  onCaptionFontSizeChange?: (size: number) => void
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

const CAPTION_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
]

export function PlayerSettings({
  visible,
  availableLevels,
  currentLevel,
  playbackRate,
  volume,
  isMuted,
  onSetQuality,
  onSetPlaybackRate,
  onSetVolume,
  onToggleMute,
  onClose,
  captionsEnabled = true,
  captionsLanguage = 'en',
  captionFontSize = 18,
  onToggleCaptions,
  onCaptionLanguageChange,
  onCaptionFontSizeChange,
}: PlayerSettingsProps) {
  const effectiveVolume = isMuted ? 0 : volume

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose()
  }

  if (!visible) return null

  return (
    <motion.div
      className="absolute inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Player settings"
    >
      <motion.div
        className="glass-dark rounded-2xl p-5 sm:p-6 w-full max-w-md text-white max-h-[90vh] overflow-y-auto scrollbar-premium"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.34, 1.4, 0.64, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">Settings</h3>
          <button
            type="button"
            aria-label="Close settings"
            onClick={onClose}
            className="player-focusable p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors focus-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quality */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-white/90">
            <Gauge className="h-4 w-4" aria-hidden />
            Quality
          </h4>
          <div className="space-y-1">
            <button
              type="button"
              aria-pressed={currentLevel === -1}
              onClick={() => onSetQuality(-1)}
              className={cn(
                'player-focusable w-full text-left px-3 py-2 text-sm rounded-lg transition-colors focus-ring',
                currentLevel === -1
                  ? 'bg-primary/30 text-primary font-medium'
                  : 'text-white/80 hover:bg-white/10',
              )}
            >
              Auto
              {currentLevel === -1 ? ' · current' : ''}
            </button>
            {availableLevels.map((level) => {
              const active = currentLevel === level.index
              return (
                <button
                  key={level.index}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSetQuality(level.index)}
                  className={cn(
                    'player-focusable w-full text-left px-3 py-2 text-sm rounded-lg transition-colors focus-ring flex items-center justify-between gap-3',
                    active
                      ? 'bg-primary/30 text-primary font-medium'
                      : 'text-white/80 hover:bg-white/10',
                  )}
                >
                  <span>{level.label}</span>
                  <span className="text-xs text-white/60">
                    {Math.round(level.bitrate / 1000)} kbps
                  </span>
                </button>
              )
            })}
            {availableLevels.length === 0 ? (
              <p className="text-xs text-white/50 px-3 py-2">
                Quality options will appear once the stream loads.
              </p>
            ) : null}
          </div>
        </div>

        {/* Playback speed */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-white/90">
            <Clock className="h-4 w-4" aria-hidden />
            Playback speed
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {PLAYBACK_RATES.map((rate) => {
              const active = playbackRate === rate
              return (
                <button
                  key={rate}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSetPlaybackRate(rate)}
                  className={cn(
                    'player-focusable py-2 rounded-lg text-sm font-medium transition-colors focus-ring min-h-[40px]',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-white/10 hover:bg-white/20 text-white',
                  )}
                >
                  {rate}&times;
                </button>
              )
            })}
          </div>
        </div>

        {/* Volume */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-white/90">
            {isMuted ? (
              <VolumeX className="h-4 w-4" aria-hidden />
            ) : (
              <Volume2 className="h-4 w-4" aria-hidden />
            )}
            Volume
          </h4>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              aria-pressed={isMuted}
              onClick={onToggleMute}
              className="player-focusable p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors focus-ring"
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
              className="player-focusable flex-1 h-2 cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${
                  effectiveVolume * 100
                }%, rgba(255,255,255,0.2) ${
                  effectiveVolume * 100
                }%, rgba(255,255,255,0.2) 100%)`,
                borderRadius: '9999px',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            />
            <span className="text-sm w-12 text-right tabular-nums">
              {Math.round(effectiveVolume * 100)}%
            </span>
          </div>
        </div>

        {/* Phase 4: AI Captions */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-white/60 text-xs font-medium uppercase tracking-wider mb-3">
            <Languages className="h-3.5 w-3.5" />
            <span>AI Captions</span>
          </div>
          <div className="space-y-3">
            {/* Enable toggle */}
            <div className="flex items-center justify-between">
              <span className="text-white/70 text-sm">Enable captions</span>
              <button
                type="button"
                role="switch"
                aria-checked={captionsEnabled}
                aria-label="Toggle AI captions"
                onClick={onToggleCaptions}
                className={cn(
                  'relative w-12 h-7 rounded-full transition-colors',
                  captionsEnabled ? 'bg-primary' : 'bg-white/20',
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-5 h-5 rounded-full bg-white transition-transform',
                    captionsEnabled ? 'translate-x-6' : 'translate-x-1',
                  )}
                />
              </button>
            </div>

            {/* Language */}
            {captionsEnabled ? (
              <div>
                <label
                  htmlFor="caption-lang"
                  className="text-white/50 text-xs block mb-1.5"
                >
                  Caption language
                </label>
                <select
                  id="caption-lang"
                  value={captionsLanguage}
                  onChange={(e) => onCaptionLanguageChange?.(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CAPTION_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} className="text-gray-900">
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {/* Font size */}
            {captionsEnabled ? (
              <div>
                <div className="flex justify-between text-white/50 text-xs mb-1.5">
                  <span>Font size</span>
                  <span className="tabular-nums">{captionFontSize}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={32}
                  step={1}
                  value={captionFontSize}
                  onChange={(e) =>
                    onCaptionFontSizeChange?.(parseInt(e.target.value, 10))
                  }
                  className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-primary"
                  style={{
                    background: `linear-gradient(to right, var(--primary) 0%, var(--primary) ${((captionFontSize - 12) / 20) * 100}%, rgba(255,255,255,0.2) ${((captionFontSize - 12) / 20) * 100}%, rgba(255,255,255,0.2) 100%)`,
                    borderRadius: '9999px',
                    appearance: 'none',
                    WebkitAppearance: 'none',
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
