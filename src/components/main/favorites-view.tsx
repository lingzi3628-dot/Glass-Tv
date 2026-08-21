'use client'

import * as React from 'react'

import { Heart } from 'lucide-react'

import { cn } from '@/lib/utils'
import { ChannelCard } from '@/components/glass/channel-card'
import { GradientButton } from '@/components/glass/gradient-button'
import { useAppStore } from '@/lib/store/app-store'
import { useFavorites } from '@/lib/hooks/use-favorites'
import type { Channel } from '@/lib/types'
import { ChannelCardGridSkeleton } from './channel-card-skeleton'

interface FavoritesResponse {
  channels?: Channel[]
  error?: string
}

export function FavoritesView() {
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const { favoriteIds, toggleFavorite } = useFavorites()

  const [channels, setChannels] = React.useState<Channel[]>([])
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/favorites', { method: 'GET' })
      const data = (await res.json()) as FavoritesResponse
      if (res.ok && data.channels) {
        setChannels(data.channels)
      } else {
        setChannels([])
      }
    } catch {
      setChannels([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  // Keep the local list in sync when a favorite is removed via the heart
  // toggle on a card (the optimistic UI in useFavorites has already flipped
  // the Set; we just filter the rendered list).
  const visibleChannels = React.useMemo<Channel[]>(() => {
    return channels.filter((c) => favoriteIds.has(c.id))
  }, [channels, favoriteIds])

  function handleToggle(channelId: string) {
    // If the channel is currently favorited, removing it should also drop
    // it from the local list so the card disappears.
    void toggleFavorite(channelId)
    if (favoriteIds.has(channelId)) {
      setChannels((prev) => prev.filter((c) => c.id !== channelId))
    }
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Your Favorites
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading
            ? 'Loading...'
            : visibleChannels.length === 0
              ? 'Tap the heart on any channel to save it here.'
              : `${visibleChannels.length} saved channel${
                  visibleChannels.length === 1 ? '' : 's'
                }.`}
        </p>
      </header>

      {loading ? (
        <ChannelCardGridSkeleton count={4} />
      ) : visibleChannels.length === 0 ? (
        <div
          className={cn(
            'card-solid rounded-2xl p-10 sm:p-16 text-center',
            'flex flex-col items-center gap-4',
          )}
        >
          <div
            aria-hidden
            className="h-20 w-20 rounded-full bg-muted flex items-center justify-center"
          >
            <Heart className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-foreground">
              No favorites yet
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Tap the heart on any channel to save it here. Your favorites
              will appear on this page for quick access.
            </p>
          </div>
          <GradientButton size="sm" onClick={() => setActiveTab('guide')}>
            Browse channels
          </GradientButton>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              favorited
              onToggleFavorite={() => handleToggle(channel.id)}
              onClick={() => setActiveTab('home')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
