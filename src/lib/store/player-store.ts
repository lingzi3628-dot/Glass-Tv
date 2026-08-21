import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * player-store
 *
 * Single source of truth for the full-screen Player's state. The Player
 * component subscribes to slices of this store and applies them to the
 * underlying <video> element via effects. The video's own events
 * (play/pause/timeupdate/volumechange/...) sync back into the store so the
 * UI always reflects the real playback state.
 *
 * Only `volume` and `playbackRate` are persisted to localStorage (the user's
 * preferences). Everything else (currentTime, currentLevel, isPlaying, ...)
 * is per-session and resets when the Player unmounts or the channel changes.
 */

export interface QualityLevel {
  index: number
  height: number
  width: number
  bitrate: number
  label: string
}

export interface PlayerStoreState {
  // --- Playback ---
  isPlaying: boolean
  isMuted: boolean
  volume: number // 0..1
  currentTime: number // seconds
  duration: number // seconds
  buffering: boolean
  playbackRate: number

  // --- Quality (hls.js levels) ---
  currentLevel: number // -1 = auto
  availableLevels: QualityLevel[]

  // --- UI flags ---
  controlsVisible: boolean
  isFullscreen: boolean
  isPiP: boolean
  showSettings: boolean
  showQualitySelector: boolean

  // --- Setters ---
  setPlaying: (v: boolean) => void
  setMuted: (v: boolean) => void
  setVolume: (v: number) => void
  setCurrentTime: (v: number) => void
  setDuration: (v: number) => void
  setBuffering: (v: boolean) => void
  setPlaybackRate: (v: number) => void
  setCurrentLevel: (v: number) => void
  setAvailableLevels: (v: QualityLevel[]) => void
  setControlsVisible: (v: boolean) => void
  setFullscreen: (v: boolean) => void
  setPiP: (v: boolean) => void
  setShowSettings: (v: boolean) => void
  setShowQualitySelector: (v: boolean) => void

  // --- Toggles ---
  togglePlay: () => void
  toggleMute: () => void
  toggleFullscreen: () => void
  togglePiP: () => void
  toggleSettings: () => void
  toggleQualitySelector: () => void

  // --- Other ---
  /** Updates currentTime in the store only. The Player applies it to the video. */
  seekTo: (time: number) => void
  /** Resets all per-session state, preserving volume + playbackRate. */
  reset: () => void
}

const initialSessionState = {
  isPlaying: false,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  buffering: false,
  currentLevel: -1,
  availableLevels: [] as QualityLevel[],
  controlsVisible: true,
  isFullscreen: false,
  isPiP: false,
  showSettings: false,
  showQualitySelector: false,
}

const initialPreferences = {
  volume: 1,
  playbackRate: 1,
}

export const usePlayerStore = create<PlayerStoreState>()(
  persist(
    (set) => ({
      ...initialSessionState,
      ...initialPreferences,

      setPlaying: (v) => set({ isPlaying: v }),
      setMuted: (v) => set({ isMuted: v }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
      setCurrentTime: (v) => set({ currentTime: v }),
      setDuration: (v) => set({ duration: v }),
      setBuffering: (v) => set({ buffering: v }),
      setPlaybackRate: (v) => set({ playbackRate: v }),
      setCurrentLevel: (v) => set({ currentLevel: v }),
      setAvailableLevels: (v) => set({ availableLevels: v }),
      setControlsVisible: (v) => set({ controlsVisible: v }),
      setFullscreen: (v) => set({ isFullscreen: v }),
      setPiP: (v) => set({ isPiP: v }),
      setShowSettings: (v) => set({ showSettings: v }),
      setShowQualitySelector: (v) => set({ showQualitySelector: v }),

      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
      toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
      toggleFullscreen: () => set((s) => ({ isFullscreen: !s.isFullscreen })),
      togglePiP: () => set((s) => ({ isPiP: !s.isPiP })),
      toggleSettings: () =>
        set((s) => ({
          showSettings: !s.showSettings,
          showQualitySelector: false,
        })),
      toggleQualitySelector: () =>
        set((s) => ({ showQualitySelector: !s.showQualitySelector })),

      seekTo: (time) => set({ currentTime: Math.max(0, time) }),

      reset: () =>
        set((s) => ({
          ...initialSessionState,
          // Preserve the user's preferences across open/close cycles.
          volume: s.volume,
          playbackRate: s.playbackRate,
        })),
    }),
    {
      name: 'glasstv-player',
      partialize: (state) => ({
        volume: state.volume,
        playbackRate: state.playbackRate,
      }),
    },
  ),
)
