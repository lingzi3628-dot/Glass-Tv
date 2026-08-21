import { create } from 'zustand'

export type AppView = 'landing' | 'login' | 'signup' | 'onboarding' | 'app'
export type AppTab = 'home' | 'guide' | 'favorites' | 'profile'

export interface AppState {
  view: AppView
  activeTab: AppTab
  setView: (v: AppView) => void
  setActiveTab: (t: AppTab) => void
  goToApp: (tab?: AppTab) => void
}

export const useAppStore = create<AppState>((set) => ({
  view: 'landing',
  activeTab: 'home',
  setView: (v) => set({ view: v }),
  setActiveTab: (t) => set({ activeTab: t }),
  goToApp: (tab) =>
    set({ view: 'app', activeTab: tab ?? 'home' }),
}))
