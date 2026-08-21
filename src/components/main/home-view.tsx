'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { ChannelCard } from '@/components/glass/channel-card'
import { GradientButton } from '@/components/glass/gradient-button'
import { useAuthStore } from '@/lib/store/auth-store'
import { useAppStore } from '@/lib/store/app-store'
import { useFavorites } from '@/lib/hooks/use-favorites'
import type { Channel } from '@/lib/types'
import { ChannelCardSkeleton } from './channel-card-skeleton'

interface ChannelsResponse {
  channels?: Channel[]
  error?: string
}

function useChannels(limit: number) {
  const [channels, setChannels] = React.useState<Channel[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const res = await fetch(`/api/channels?limit=${limit}`)
        const data = (await res.json()) as ChannelsResponse
        if (!cancelled && res.ok && data.channels) {
          setChannels(data.channels)
        }
      } catch {
        // Leave state empty - the empty state will render.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [limit])

  return { channels, loading }
}

function getGreeting(date: Date = new Date()): string {
  const h = date.getHours()
  if (h < 12) return 'Good Morning'
  if (h < 18) return 'Good Afternoon'
  return 'Good Evening'
}

function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4 mt-8 first:mt-0">
      <h2 className="text-lg sm:text-xl font-bold text-foreground">{title}</h2>
      {action}
    </div>
  )
}

export function HomeView() {
  const user = useAuthStore((s) => s.user)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const { channels, loading } = useChannels(20)
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites()

  const displayName = user?.displayName || 'TV Lover'
  const onboardingCompleted = user?.onboardingCompleted ?? false
  const greeting = React.useMemo(() => getGreeting(), [])

  // Convert favoriteIds Set -> Channel[] for "Continue Watching".
  // For Phase 1 we surface the user's first 4 favorites; if they have none,
  // fall back to the first 4 verified channels as a teaser.
  const continueWatching = React.useMemo<Channel[]>(() => {
    if (channels.length === 0) return []
    const favs = channels.filter(
      (c) => favoriteIds.has(c.id) && c.isVerified !== false,
    )
    if (favs.length >= 4) return favs.slice(0, 4)
    const favsAny = channels.filter((c) => favoriteIds.has(c.id))
    if (favsAny.length >= 4) return favsAny.slice(0, 4)
    const merged = [...favsAny]
    for (const c of channels) {
      if (merged.length >= 4) break
      if (!merged.some((m) => m.id === c.id)) merged.push(c)
    }
    return merged.slice(0, 4)
  }, [channels, favoriteIds])

  const recommended = React.useMemo<Channel[]>(() => {
    // Prefer verified channels for the recommendation strip.
    const verified = channels.filter((c) => c.isVerified)
    const pool = verified.length >= 4 ? verified : channels
    return pool.slice(0, 8)
  }, [channels])

  const allChannels = channels

  return (
    <div className="space-y-2">
      {/* Hero */}
      <section
        className={cn(
          'rounded-3xl p-6 sm:p-8',
          'bg-gradient-to-br from-primary/10 via-secondary/5 to-transparent',
          'border border-border',
        )}
      >
        <p className="text-sm font-medium text-primary">{greeting}</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-foreground">
          {displayName}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl">
          {onboardingCompleted
            ? 'Your personalized channels are ready.'
            : "Let's find something great to watch."}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <GradientButton
            size="sm"
            onClick={() => setActiveTab('guide')}
          >
            Browse all channels
          </GradientButton>
          {!onboardingCompleted ? (
            <GradientButton
              size="sm"
              onClick={() =>
                useAppStore.getState().setView('onboarding')
              }
              className="bg-card text-foreground border border-border hover:bg-muted"
            >
              Set preferences
            </GradientButton>
          ) : null}
        </div>
      </section>

      {/* Continue Watching */}
      <section>
        <SectionHeader title="Continue Watching" />
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ChannelCardSkeleton key={i} />
            ))}
          </div>
        ) : continueWatching.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <ChannelCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {continueWatching.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                favorited={isFavorite(channel.id)}
                onToggleFavorite={() => toggleFavorite(channel.id)}
                onClick={() => setActiveTab('guide')}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recommended */}
      <section>
        <SectionHeader
          title="Recommended for You"
          action={
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className="text-sm font-medium text-primary hover:underline focus-ring rounded"
            >
              See all
            </button>
          }
        />
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ChannelCardSkeleton key={i} />
            ))}
          </div>
        ) : recommended.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No channels available right now.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {recommended.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                favorited={isFavorite(channel.id)}
                onToggleFavorite={() => toggleFavorite(channel.id)}
                onClick={() => setActiveTab('guide')}
              />
            ))}
          </div>
        )}
      </section>

      {/* All Channels - horizontal scroller */}
      <section>
        <SectionHeader
          title="All Channels"
          action={
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className="text-sm font-medium text-primary hover:underline focus-ring rounded"
            >
              See all
            </button>
          }
        />
        {loading ? (
          <div className="flex gap-4 overflow-hidden pb-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <ChannelCardSkeleton key={i} className="min-w-[180px] flex-1" />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto scrollbar-premium pb-2 -mx-1 px-1">
            {allChannels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                favorited={isFavorite(channel.id)}
                onToggleFavorite={() => toggleFavorite(channel.id)}
                onClick={() => setActiveTab('guide')}
                className="min-w-[180px] max-w-[220px]"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
