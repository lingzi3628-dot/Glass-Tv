import { create } from 'zustand'

export interface AuthUser {
  id: string
  email: string
  displayName: string | null
  avatar: string | null
  onboardingCompleted: boolean
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

export interface AuthState {
  user: AuthUser | null
  status: AuthStatus
  setUser: (u: AuthUser | null) => void
  setStatus: (s: AuthStatus) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  setUser: (u) => set({ user: u }),
  setStatus: (s) => set({ status: s }),
  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Network or server error - still clear local state so the UI
      // reflects the logout attempt. The cookie will be cleared on the
      // next page load if the server call failed.
    } finally {
      set({ user: null, status: 'unauthenticated' })
    }
  },
}))
