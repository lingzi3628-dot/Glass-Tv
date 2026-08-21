import { create } from 'zustand'

import type { Channel } from '@/lib/types'

export type AppView = 'landing' | 'login' | 'signup' | 'onboarding' | 'app'
export type AppTab = 'home' | 'guide' | 'favorites' | 'profile'

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

  setView: (v) => set({ view: v }),
  setActiveTab: (t) => set({ activeTab: t }),
  goToApp: (tab) =>
    set({ view: 'app', activeTab: tab ?? 'home' }),
}))
