'use client'

import * as React from 'react'

import type { Channel } from '@/lib/types'

export interface HistoryEntry {
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

/**
 * Fetches the user's watch history from `/api/history`.
 * Used by the Home "Continue Watching" rail.
 *
 * Returns `{ history, loading, refresh }`. Call `refresh()` after closing
 * the player to pick up any new entries.
 */
export function useWatchHistory() {
  const [history, setHistory] = React.useState<HistoryEntry[]>([])
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/history', { cache: 'no-store' })
      const data = (await res.json()) as HistoryResponse
      if (res.ok && data.data) {
        setHistory(data.data)
      }
    } catch {
      // Leave state empty - the Continue Watching rail just won't render.
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return { history, loading, refresh }
}
