'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Tv } from 'lucide-react'
import { useAppStore } from '@/lib/store/app-store'
import { useAuthStore } from '@/lib/store/auth-store'
import { LandingPage } from '@/components/landing/landing-page'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'
import { OnboardingFlow } from '@/components/auth/OnboardingFlow'
import { AppShell } from '@/components/main/app-shell'

/**
 * GlassTV is a single-page app. The only user-visible route is `/`, and it
 * orchestrates between five top-level "views" based on Zustand state:
 *
 *   landing    -> marketing/intro screen (only when unauthenticated)
 *   login      -> LoginForm
 *   signup     -> SignupForm
 *   onboarding -> OnboardingFlow
 *   app        -> AppShell (home / guide / favorites / profile tabs)
 *
 * On first load we probe `/api/auth/me` to hydrate the auth store. If the user
 * is signed in we route them to onboarding (if not yet completed) or straight
 * into the app.
 */
export default function Home() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const goToApp = useAppStore((s) => s.goToApp)

  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)
  const setUser = useAuthStore((s) => s.setUser)
  const setStatus = useAuthStore((s) => s.setStatus)

  // Hydrate auth state from the session cookie on first mount.
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      setStatus('loading')
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' })
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          const u = data.user
          setUser(u)
          setStatus('authenticated')
          // Only auto-route if the user is currently on a pre-auth view.
          // This lets explicit login/signup clicks override the redirect.
          const current = useAppStore.getState().view
          if (current === 'landing' || current === 'login' || current === 'signup') {
            if (u.onboardingCompleted) {
              goToApp('home')
            } else {
              setView('onboarding')
            }
          }
        } else {
          setUser(null)
          setStatus('unauthenticated')
          // Ensure we're on the landing view if not authed.
          const current = useAppStore.getState().view
          if (current === 'app' || current === 'onboarding') {
            setView('landing')
          }
        }
      } catch {
        if (cancelled) return
        setUser(null)
        setStatus('unauthenticated')
        setView('landing')
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  // Loading state while we probe the session.
  if (status === 'loading') {
    return <LoadingScreen />
  }

  // If authenticated but somehow on a pre-auth view, snap to the right place.
  // (Guards against stale state e.g. after onboarding completion.)
  if (status === 'authenticated' && user) {
    if (view === 'landing' || view === 'login' || view === 'signup') {
      // Authed users shouldn't sit on the marketing/login screens.
      if (user.onboardingCompleted) {
        return <AppShell />
      }
      return <OnboardingWrapper />
    }
    if (view === 'onboarding') {
      return <OnboardingWrapper />
    }
    return <AppShell />
  }

  // Unauthenticated: only landing / login / signup are reachable.
  if (view === 'login') return <LoginForm />
  if (view === 'signup') return <SignupForm />
  // Default + 'onboarding' + 'app' (shouldn't happen when unauthed) -> landing.
  return <LandingPage />
}

/** Wrap OnboardingFlow so a completed-onboarding user skips straight to the app. */
function OnboardingWrapper() {
  const user = useAuthStore((s) => s.user)
  const goToApp = useAppStore((s) => s.goToApp)
  const setView = useAppStore((s) => s.setView)

  useEffect(() => {
    if (user?.onboardingCompleted) {
      goToApp('home')
    }
  }, [user, goToApp, setView])

  if (user?.onboardingCompleted) return <LoadingScreen />
  return <OnboardingFlow />
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.4, 0.64, 1] }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-xl shadow-primary/30"
      >
        <Tv className="w-8 h-8 text-primary-foreground" />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 text-muted-foreground"
      >
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-sm">Loading GlassTV…</span>
      </motion.div>
    </div>
  )
}
