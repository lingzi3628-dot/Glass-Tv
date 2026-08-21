'use client'

import * as React from 'react'

import { LogOut, RefreshCw, Tv } from 'lucide-react'

import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { useAppStore } from '@/lib/store/app-store'
import { useAuthStore } from '@/lib/store/auth-store'
import { useFavorites } from '@/lib/hooks/use-favorites'

interface StatsResponse {
  channels?: Array<{ id: string }>
  error?: string
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    }
    return name.trim().slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function ProfileView() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const setView = useAppStore((s) => s.setView)
  const { favoriteIds } = useFavorites()

  const [channelCount, setChannelCount] = React.useState<number | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await fetch('/api/channels?limit=200')
        const data = (await res.json()) as StatsResponse
        if (!cancelled && res.ok && data.channels) {
          setChannelCount(data.channels.length)
        }
      } catch {
        // Ignore - the stat row simply won't render.
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const displayName = user?.displayName || 'TV Lover'
  const email = user?.email || ''
  const avatarUrl = user?.avatar ?? null
  const onboardingCompleted = user?.onboardingCompleted ?? false

  async function handleLogout() {
    await logout()
    setView('landing')
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account and settings summary.
        </p>
      </header>

      {/* Identity card */}
      <GlassCard variant="premium" hoverable={false} className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-20 w-20 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div
              className={cn(
                'h-20 w-20 rounded-full flex items-center justify-center',
                'bg-gradient-to-br from-primary to-secondary',
                'text-primary-foreground text-xl font-bold',
              )}
              aria-hidden
            >
              {getInitials(user?.displayName, email)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-foreground truncate">
              {displayName}
            </h2>
            <p className="text-sm text-muted-foreground truncate">{email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-card border border-border px-2.5 py-0.5 text-xs font-medium text-foreground/80">
                <Tv className="h-3 w-3" aria-hidden /> GlassTV Member
              </span>
              {onboardingCompleted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Onboarding complete
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  Onboarding pending
                </span>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard hoverable={false} className="p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Favorites
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {favoriteIds.size}
          </p>
        </GlassCard>
        <GlassCard hoverable={false} className="p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Channels available
          </p>
          <p className="mt-1 text-3xl font-bold text-foreground">
            {channelCount ?? '—'}
          </p>
        </GlassCard>
      </div>

      {/* Preferences */}
      <GlassCard hoverable={false} className="p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Preferences</h3>
          <p className="text-sm text-muted-foreground">
            {onboardingCompleted
              ? 'Re-run onboarding anytime to update your recommendations.'
              : 'Complete onboarding to personalize your channel recommendations.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => setView('onboarding')}
          >
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden />
            {onboardingCompleted ? 'Re-run onboarding' : 'Complete onboarding'}
          </GlassButton>
        </div>
      </GlassCard>

      {/* Sign out */}
      <GlassCard hoverable={false} className="p-6 space-y-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Session</h3>
          <p className="text-sm text-muted-foreground">
            Sign out of GlassTV on this device.
          </p>
        </div>
        <GlassButton variant="secondary" size="md" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" aria-hidden />
          Sign out
        </GlassButton>
      </GlassCard>
    </div>
  )
}
