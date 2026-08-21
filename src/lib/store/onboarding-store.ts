import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OnboardingState {
  selectedGenres: string[]
  selectedLanguages: string[]
  viewingTime: string | null // morning | afternoon | evening | late_night
  viewingDevice: string | null // phone | tablet | tv | computer
  recommendations: string[] // channel ids returned by the AI
  toggleGenre: (g: string) => void
  toggleLanguage: (l: string) => void
  setViewingTime: (t: string) => void
  setViewingDevice: (d: string) => void
  setRecommendations: (ids: string[]) => void
  reset: () => void
}

const initialState = {
  selectedGenres: [] as string[],
  selectedLanguages: [] as string[],
  viewingTime: null as string | null,
  viewingDevice: null as string | null,
  recommendations: [] as string[],
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      ...initialState,
      toggleGenre: (g) =>
        set((state) => ({
          selectedGenres: state.selectedGenres.includes(g)
            ? state.selectedGenres.filter((x) => x !== g)
            : [...state.selectedGenres, g],
        })),
      toggleLanguage: (l) =>
        set((state) => ({
          selectedLanguages: state.selectedLanguages.includes(l)
            ? state.selectedLanguages.filter((x) => x !== l)
            : [...state.selectedLanguages, l],
        })),
      setViewingTime: (t) => set({ viewingTime: t }),
      setViewingDevice: (d) => set({ viewingDevice: d }),
      setRecommendations: (ids) => set({ recommendations: ids }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'glasstv-onboarding',
    },
  ),
)
