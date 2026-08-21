'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Tv } from 'lucide-react'

import { useAppStore } from '@/lib/store/app-store'
import { useAuthStore } from '@/lib/store/auth-store'
import { LandingPage } from '@/components/landing/landing-page'
import { LoginForm } from '@/components/auth/LoginForm'
import { SignupForm } from '@/components/auth/SignupForm'
import { OnboardingFlow } from '@/components/auth/OnboardingFlow'
import { AppShell } from '@/components/main/app-shell'
import { PreviewPopup } from '@/components/popup/preview-popup'
import { PlayerOverlay } from '@/components/player/player-overlay'
import type { Channel } from '@/lib/types'

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
 *
 * Phase 2 also renders two always-mounted overlays on top of whatever view is
 * active: a transient `PreviewPopup` (the HLS mini-player that auto-appears
 * ~2s after the user lands in the app) and the full-screen `PlayerOverlay`
 * (driven by `useAppStore.playerChannel`).
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

  let content: React.ReactNode
  if (status === 'loading') {
    content = <LoadingScreen />
  } else if (status === 'authenticated' && user) {
    if (view === 'landing' || view === 'login' || view === 'signup') {
      // Authed users shouldn't sit on the marketing/login screens.
      content = user.onboardingCompleted ? <AppShell /> : <OnboardingWrapper />
    } else if (view === 'onboarding') {
      content = <OnboardingWrapper />
    } else {
      content = <AppShell />
    }
  } else {
    // Unauthenticated: only landing / login / signup are reachable.
    content =
      view === 'login' ? <LoginForm /> : view === 'signup' ? (
        <SignupForm />
      ) : (
        <LandingPage />
      )
  }

  return (
    <>
      {content}
      <AutoPreviewTrigger />
      <PreviewPopupHost />
      <PlayerOverlayHost />
    </>
  )
}

/**
 * AutoPreviewTrigger — schedules a one-shot 2s timer that opens the
 * PreviewPopup the first time the user lands in the app (`view === 'app'`
 * and `status === 'authenticated'`). Uses a ref guard so it only fires
 * once per page session (a reload resets it, which is the intended UX).
 */
function AutoPreviewTrigger() {
  const view = useAppStore((s) => s.view)
  const status = useAuthStore((s) => s.status)
  const openPreview = useAppStore((s) => s.openPreview)
  const previewChannel = useAppStore((s) => s.previewChannel)
  const playerChannel = useAppStore((s) => s.playerChannel)

  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    if (view !== 'app' || status !== 'authenticated') return
    if (previewChannel || playerChannel) return

    firedRef.current = true
    let cancelled = false

    const timeoutId = window.setTimeout(async () => {
      if (cancelled) return
      try {
        // Pick the first verified channel from the catalog as the
        // featured preview. Verified channels are the highest-quality
        // entries and most likely to have a real streamUrl.
        const res = await fetch('/api/channels?limit=20')
        const data = (await res.json()) as {
          channels?: Channel[]
          error?: string
        }
        if (cancelled) return
        const list = data.channels ?? []
        if (list.length === 0) return
        const featured =
          list.find((c) => c.isVerified) ?? list[0]
        if (!featured) return
        // Only open the preview if the user hasn't already dismissed it
        // or opened another popup in the meantime.
        const current = useAppStore.getState()
        if (current.previewChannel || current.playerChannel) return
        openPreview(featured)
      } catch {
        // Network failure - silently skip. The user can still browse
        // channels manually.
      }
    }, 2000)

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [view, status, openPreview, previewChannel, playerChannel])

  return null
}

/** Renders the PreviewPopup when `previewChannel` is set in the store. */
function PreviewPopupHost() {
  const previewChannel = useAppStore((s) => s.previewChannel)
  const closePreview = useAppStore((s) => s.closePreview)
  const openPlayer = useAppStore((s) => s.openPlayer)

  return (
    <AnimatePresence>
      {previewChannel ? (
        <PreviewPopup
          channel={previewChannel}
          onWatch={(ch) => {
            closePreview()
            openPlayer(ch)
          }}
          onDismiss={closePreview}
        />
      ) : null}
    </AnimatePresence>
  )
}

/** Renders the full-screen PlayerOverlay when `playerChannel` is set. */
function PlayerOverlayHost() {
  const playerChannel = useAppStore((s) => s.playerChannel)
  return (
    <AnimatePresence>
      {playerChannel ? <PlayerOverlay /> : null}
    </AnimatePresence>
  )
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
