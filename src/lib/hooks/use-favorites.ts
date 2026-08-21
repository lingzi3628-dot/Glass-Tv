'use client'

import * as React from 'react'

/**
 * useFavorites
 *
 * Shared hook that keeps an in-memory `Set<string>` of favorited channel
 * ids, fetched from /api/favorites on mount. Toggle is **optimistic** -
 * the local state flips immediately and the API call happens in the
 * background; on network failure we revert.
 *
 * All four tab views (Home, Guide, Favorites, Profile) can call
 * `isFavorite(id)` / `toggleFavorite(id)` / `refresh()` and stay in sync.
 */

export interface UseFavoritesResult {
  favoriteIds: Set<string>
  isFavorite: (id: string) => boolean
  toggleFavorite: (id: string) => void
  refresh: () => Promise<void>
  loading: boolean
}

interface FavoritesResponse {
  channels?: Array<{ id: string }>
  error?: string
}

export function useFavorites(): UseFavoritesResult {
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(
    () => new Set(),
  )
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/favorites', { method: 'GET' })
      const data = (await res.json()) as FavoritesResponse
      if (res.ok && data.channels) {
        setFavoriteIds(new Set(data.channels.map((c) => c.id)))
      }
    } catch {
      // Network failure - keep the existing state so the UI doesn't
      // wipe favorites the user just added.
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  const isFavorite = React.useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds],
  )

  const toggleFavorite = React.useCallback(
    async (id: string) => {
      // Optimistic update.
      const wasFavorite = favoriteIds.has(id)
      setFavoriteIds((prev) => {
        const next = new Set(prev)
        if (wasFavorite) next.delete(id)
        else next.add(id)
        return next
      })

      try {
        if (wasFavorite) {
          await fetch(`/api/favorites/${encodeURIComponent(id)}`, {
            method: 'DELETE',
          })
        } else {
          await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelId: id }),
          })
        }
      } catch {
        // Revert on network failure.
        setFavoriteIds((prev) => {
          const next = new Set(prev)
          if (wasFavorite) next.add(id)
          else next.delete(id)
          return next
        })
      }
    },
    [favoriteIds],
  )

  return { favoriteIds, isFavorite, toggleFavorite, refresh, loading }
}
