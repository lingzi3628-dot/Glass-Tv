'use client'

import * as React from 'react'

import { ChannelGrid } from '@/components/channels/channel-grid'
import { SEARCH_SESSION_KEY } from './header'

/**
 * The Channel Guide — a full browse surface powered by the reusable
 * <ChannelGrid /> component (search, category chips, language filter,
 * pagination, load-more, empty state).
 *
 * Clicking a channel opens the full-screen PlayerOverlay (the default
 * behaviour of ChannelGrid when no `onChannelClick` prop is supplied).
 *
 * The guide also honours a search query stashed in sessionStorage by the
 * Header's search box — we seed ChannelGrid's initial search via a key
 * remount so it picks up the query on first render.
 */
export function GuideView() {
  const [seedQuery, setSeedQuery] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const q = window.sessionStorage.getItem(SEARCH_SESSION_KEY)
      if (q && q.trim().length > 0) {
        setSeedQuery(q.trim())
      } else {
        setSeedQuery('')
      }
      // Consume the stashed query so a later tab-switch doesn't re-apply it.
      window.sessionStorage.removeItem(SEARCH_SESSION_KEY)
    } catch {
      setSeedQuery('')
    }
  }, [])

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Channel Guide
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse all channels. Filter by category or language, or search by
          name. Click any channel to start watching.
        </p>
      </header>

      {/* Don't render the grid until we've checked sessionStorage so the
          seed query is applied on the first fetch. */}
      {seedQuery !== null ? (
        <ChannelGrid
          key={seedQuery || 'all'}
          initialSearch={seedQuery || undefined}
          pageSize={24}
        />
      ) : null}
    </div>
  )
}
