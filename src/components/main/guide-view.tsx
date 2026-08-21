'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { ChannelCard } from '@/components/glass/channel-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store/app-store'
import { useFavorites } from '@/lib/hooks/use-favorites'
import {
  CHANNEL_CATEGORIES,
  CHANNEL_LANGUAGES,
  type Channel,
} from '@/lib/types'
import { SEARCH_SESSION_KEY } from './header'
import { ChannelCardGridSkeleton } from './channel-card-skeleton'

interface ChannelsResponse {
  channels?: Channel[]
  error?: string
}

const ALL_CATEGORIES = ['all', ...CHANNEL_CATEGORIES] as const
const ALL_LANGUAGES = ['all', ...CHANNEL_LANGUAGES] as const

export function GuideView() {
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const { isFavorite, toggleFavorite } = useFavorites()

  // Seed the search input from sessionStorage on mount (the Header writes
  // there when the user submits the search box).
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState<string>('all')
  const [language, setLanguage] = React.useState<string>('all')

  const [channels, setChannels] = React.useState<Channel[]>([])
  const [loading, setLoading] = React.useState(true)

  // Initial sessionStorage read for the search query.
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const q = window.sessionStorage.getItem(SEARCH_SESSION_KEY)
      if (q && q.trim().length > 0) {
        setSearch(q.trim())
      }
    } catch {
      // sessionStorage unavailable - ignore.
    }
  }, [])

  // Debounce the search input so we don't fire a request on every keystroke.
  // The input field stays controlled by `search` (immediate); the fetch
  // effect below reacts to `debouncedSearch` (lags 250ms behind).
  const [debouncedSearch, setDebouncedSearch] = React.useState(search)
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 250)
    return () => window.clearTimeout(t)
  }, [search])

  // Re-fetch whenever filters change.
  React.useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (category !== 'all') params.set('category', category)
        if (language !== 'all') params.set('language', language)
        const q = debouncedSearch.trim()
        if (q) params.set('q', q)
        params.set('limit', '100')
        const res = await fetch(`/api/channels?${params.toString()}`)
        const data = (await res.json()) as ChannelsResponse
        if (!cancelled && res.ok && data.channels) {
          setChannels(data.channels)
        } else if (!cancelled) {
          setChannels([])
        }
      } catch {
        if (!cancelled) setChannels([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [category, language, debouncedSearch])

  const hasFilters =
    category !== 'all' || language !== 'all' || search.trim().length > 0

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Channel Guide
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading
            ? 'Loading channels...'
            : channels.length === 0
              ? 'No channels match your filters.'
              : `Showing ${channels.length} channel${
                  channels.length === 1 ? '' : 's'
                }. Filter by category, language, or search by name.`}
        </p>
      </header>

      {/* Filter bar */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="relative">
          <label htmlFor="glasstv-guide-search" className="sr-only">
            Search channels
          </label>
          <input
            id="glasstv-guide-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search channels..."
            className={cn(
              'focus-ring bg-card border border-border rounded-xl',
              'px-4 py-2 text-sm w-full placeholder:text-muted-foreground/70',
              'focus:border-transparent',
            )}
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* Category chips */}
          <div
            role="group"
            aria-label="Filter by category"
            className="flex flex-wrap gap-2"
          >
            {ALL_CATEGORIES.map((cat) => {
              const active = category === cat
              const label = cat === 'all' ? 'All' : cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  aria-pressed={active}
                  className={cn(
                    'focus-ring px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground/70 hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Language select */}
          <div className="ml-auto">
            <label htmlFor="glasstv-language-select" className="sr-only">
              Filter by language
            </label>
            <Select
              value={language}
              onValueChange={(v) => setLanguage(v)}
            >
              <SelectTrigger
                id="glasstv-language-select"
                size="sm"
                className="w-[140px]"
                aria-label="Filter by language"
              >
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {ALL_LANGUAGES.map((lng) => (
                  <SelectItem key={lng} value={lng}>
                    <span className="capitalize">
                      {lng === 'all' ? 'All languages' : lng}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <ChannelCardGridSkeleton count={8} />
      ) : channels.length === 0 ? (
        <div className="card-solid rounded-2xl p-10 text-center">
          <p className="text-base font-medium text-foreground">
            No channels match your filters
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing your search or selecting a different category.
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setCategory('all')
                setLanguage('all')
              }}
              className="mt-4 focus-ring text-sm font-medium text-primary hover:underline rounded"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              favorited={isFavorite(channel.id)}
              onToggleFavorite={() => toggleFavorite(channel.id)}
              onClick={() => setActiveTab('home')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
