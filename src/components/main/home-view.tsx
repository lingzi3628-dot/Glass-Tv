'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { ChannelCard } from '@/components/glass/channel-card'
import { GradientButton } from '@/components/glass/gradient-button'
import { useAuthStore } from '@/lib/store/auth-store'
import { useAppStore } from '@/lib/store/app-store'
import { useFavorites } from '@/lib/hooks/use-favorites'
import { useWatchHistory } from '@/lib/hooks/use-watch-history'
import type { Channel } from '@/lib/types'
import { ChannelCardSkeleton } from './channel-card-skeleton'

interface ChannelsResponse {
  channels?: Channel[]
  error?: string
}

interface HistoryEntry {
  id: number
  channelId: string
  watchedAt: string
  durationSeconds: number | null
  channel: Channel
}

interface HistoryResponse {
  data?: HistoryEntry[]
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
  const openPlayer = useAppStore((s) => s.openPlayer)
  const { channels, loading } = useChannels(20)
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites()
  const { history, loading: historyLoading } = useWatchHistory()

  const displayName = user?.displayName || 'TV Lover'
  const onboardingCompleted = user?.onboardingCompleted ?? false
  const greeting = React.useMemo(() => getGreeting(), [])

  // Continue Watching: REAL watch history from /api/history.
  // Dedupes by channelId (most recent first) and caps at 4.
  const continueWatching = React.useMemo<Channel[]>(() => {
    const seen = new Set<string>()
    const result: Channel[] = []
    for (const h of history) {
      if (!seen.has(h.channelId) && h.channel) {
        seen.add(h.channelId)
        result.push(h.channel)
      }
      if (result.length >= 4) break
    }
    return result
  }, [history])

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

      {/* Continue Watching — only shows when the user has watch history */}
      {historyLoading ? null : continueWatching.length > 0 ? (
        <section>
          <SectionHeader title="Continue Watching" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {continueWatching.map((channel) => (
              <div key={channel.id} className="relative">
                <ChannelCard
                  channel={channel}
                  favorited={isFavorite(channel.id)}
                  onToggleFavorite={() => toggleFavorite(channel.id)}
                  onClick={() => openPlayer(channel)}
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-semibold uppercase tracking-wide">
                  Resume
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
                onClick={() => openPlayer(channel)}
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
                onClick={() => openPlayer(channel)}
                className="min-w-[180px] max-w-[220px]"
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
