import { create } from 'zustand'

import type { Channel } from '@/lib/types'

export type AppView = 'landing' | 'login' | 'signup' | 'onboarding' | 'app'
export type AppTab = 'home' | 'guide' | 'short-drama' | 'favorites' | 'profile'

/**
 * Phase 19 — vertical mini-player state for Short Dramas.
 *
 * When `shortDramaPlayer` is set, ShortDramaPlayer renders as a full-screen
 * overlay on top of the SPA (mirroring how playerChannel drives PlayerOverlay).
 */
export interface ShortDramaPlayerState {
  dramaId: string
  dramaTitle: string
  episodeNumber: number
  totalEpisodes: number
  streamUrl: string
}

export interface AppState {
  view: AppView
  activeTab: AppTab

  // Player state — when set, the PlayerOverlay renders on top of the SPA.
  playerChannel: Channel | null
  openPlayer: (channel: Channel) => void
  closePlayer: () => void

  // Preview popup state — when set, the PreviewPopup mini-player renders.
  previewChannel: Channel | null
  openPreview: (channel: Channel) => void
  closePreview: () => void

  // Short Drama detail state — when set, the ShortDrama tab renders the
  // detail view instead of the catalog grid.
  shortDramaDetailId: string | null
  openShortDramaDetail: (dramaId: string) => void
  closeShortDramaDetail: () => void

  // Short Drama player state — when set, ShortDramaPlayer overlay renders.
  shortDramaPlayer: ShortDramaPlayerState | null
  openShortDramaPlayer: (state: ShortDramaPlayerState) => void
  closeShortDramaPlayer: () => void

  setView: (v: AppView) => void
  setActiveTab: (t: AppTab) => void
  goToApp: (tab?: AppTab) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'landing',
  activeTab: 'home',

  playerChannel: null,
  openPlayer: (channel) => set({ playerChannel: channel }),
  closePlayer: () => set({ playerChannel: null }),

  previewChannel: null,
  openPreview: (channel) => set({ previewChannel: channel }),
  closePreview: () => set({ previewChannel: null }),

  shortDramaDetailId: null,
  openShortDramaDetail: (dramaId) => set({ shortDramaDetailId: dramaId }),
  closeShortDramaDetail: () => set({ shortDramaDetailId: null }),

  shortDramaPlayer: null,
  openShortDramaPlayer: (state) => set({ shortDramaPlayer: state }),
  closeShortDramaPlayer: () => set({ shortDramaPlayer: null }),

  setView: (v) => set({ view: v }),
  setActiveTab: (t) => set({ activeTab: t }),
  goToApp: (tab) =>
    set({ view: 'app', activeTab: tab ?? 'home' }),
}))
