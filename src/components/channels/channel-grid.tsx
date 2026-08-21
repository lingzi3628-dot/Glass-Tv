'use client'

import * as React from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { useDebounce } from 'use-debounce'

import { cn } from '@/lib/utils'
import { ChannelCard } from '@/components/glass/channel-card'
import { GradientButton } from '@/components/glass/gradient-button'
import { useAppStore } from '@/lib/store/app-store'
import { useFavorites } from '@/lib/hooks/use-favorites'
import {
  CHANNEL_CATEGORIES,
  CHANNEL_LANGUAGES,
  type Channel,
} from '@/lib/types'
import { ChannelCardSkeleton } from '@/components/main/channel-card-skeleton'

export interface ChannelGridProps {
  initialChannels?: Channel[]
  initialSearch?: string
  pageSize?: number
  onChannelClick?: (ch: Channel) => void
  showFilters?: boolean
  showSearch?: boolean
  className?: string
}

interface ChannelsListResponse {
  channels?: Channel[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  categories?: string[]
  languages?: string[]
  error?: string
}

const SKELETON_COUNT = 10

export function ChannelGrid({
  initialChannels,
  initialSearch = '',
  pageSize = 20,
  onChannelClick,
  showFilters = true,
  showSearch = true,
  className,
}: ChannelGridProps) {
  const openPlayer = useAppStore((s) => s.openPlayer)
  const { isFavorite, toggleFavorite } = useFavorites()

  const [search, setSearch] = React.useState(initialSearch)
  const [debouncedSearch] = useDebounce(search, 300)
  const [category, setCategory] = React.useState<string>('all')
  const [language, setLanguage] = React.useState<string>('all')

  const [channels, setChannels] = React.useState<Channel[]>(
    initialChannels ?? [],
  )
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState<number>(
    initialChannels?.length ?? 0,
  )
  const [totalPages, setTotalPages] = React.useState<number>(1)
  const [categories, setCategories] = React.useState<string[]>(
    Array.from(CHANNEL_CATEGORIES),
  )
  const [languages, setLanguages] = React.useState<string[]>(
    Array.from(CHANNEL_LANGUAGES),
  )

  const [loadingInitial, setLoadingInitial] = React.useState<boolean>(
    !initialChannels || initialChannels.length === 0,
  )
  const [loadingMore, setLoadingMore] = React.useState<boolean>(false)
  const [error, setError] = React.useState<string | null>(null)

  // Build the URLSearchParams for the list endpoint. Centralized so the
  // initial fetch and "load more" both use the exact same shape.
  const buildParams = React.useCallback(
    (p: number) => {
      const params = new URLSearchParams()
      params.set('page', String(p))
      params.set('limit', String(pageSize))
      params.set('sort', 'name')
      params.set('order', 'asc')
      if (category !== 'all') params.set('category', category)
      if (language !== 'all') params.set('language', language)
      const q = debouncedSearch.trim()
      if (q) params.set('q', q)
      return params
    },
    [category, language, debouncedSearch, pageSize],
  )

  // Reset to page 1 whenever any filter changes (so we don't try to load
  // page 3 of a filtered set with no pages 1-2 in state).
  React.useEffect(() => {
    setPage(1)
  }, [category, language, debouncedSearch])

  // Initial / refetch-on-filter-change effect. Loads page 1.
  React.useEffect(() => {
    let cancelled = false
    async function run() {
      setLoadingInitial(true)
      setError(null)
      try {
        const params = buildParams(1)
        const res = await fetch(`/api/channels?${params.toString()}`)
        const data = (await res.json()) as ChannelsListResponse
        if (cancelled) return
        if (res.ok && data.channels) {
          setChannels(data.channels)
          setTotal(data.pagination?.total ?? data.channels.length)
          setTotalPages(
            data.pagination?.totalPages ??
              Math.max(
                1,
                Math.ceil((data.channels.length || 1) / pageSize),
              ),
          )
          if (data.categories && data.categories.length > 0) {
            setCategories(data.categories)
          }
          if (data.languages && data.languages.length > 0) {
            setLanguages(data.languages)
          }
        } else {
          setChannels([])
          setTotal(0)
          setTotalPages(1)
          setError(data.error ?? 'Failed to load channels.')
        }
      } catch {
        if (!cancelled) {
          setChannels([])
          setTotal(0)
          setTotalPages(1)
          setError('Network error while loading channels.')
        }
      } finally {
        if (!cancelled) setLoadingInitial(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [category, language, debouncedSearch, pageSize, buildParams])

  // "Load more" handler — appends the next page to the existing list.
  const handleLoadMore = React.useCallback(async () => {
    if (loadingMore || page >= totalPages) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const params = buildParams(nextPage)
      const res = await fetch(`/api/channels?${params.toString()}`)
      const data = (await res.json()) as ChannelsListResponse
      if (res.ok && data.channels) {
        setChannels((prev) => {
          // De-dupe in case the API ever returns overlapping ids.
          const seen = new Set(prev.map((c) => c.id))
          const merged = [...prev]
          for (const ch of data.channels ?? []) {
            if (!seen.has(ch.id)) {
              merged.push(ch)
              seen.add(ch.id)
            }
          }
          return merged
        })
        setPage(nextPage)
        if (data.pagination?.totalPages) {
          setTotalPages(data.pagination.totalPages)
        }
        if (data.pagination?.total) {
          setTotal(data.pagination.total)
        }
      }
    } catch {
      // Silently keep what we have - the user can retry by clicking again.
    } finally {
      setLoadingMore(false)
    }
  }, [buildParams, loadingMore, page, totalPages])

  const handleClick = React.useCallback(
    (ch: Channel) => {
      if (onChannelClick) {
        onChannelClick(ch)
      } else {
        openPlayer(ch)
      }
    },
    [onChannelClick, openPlayer],
  )

  const hasActiveFilters =
    category !== 'all' || language !== 'all' || search.trim().length > 0

  function clearFilters() {
    setSearch('')
    setCategory('all')
    setLanguage('all')
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {showFilters || showSearch ? (
        <div className="flex flex-col gap-3">
          {showSearch ? (
            <div className="relative">
              <label
                htmlFor="glasstv-channel-grid-search"
                className="sr-only"
              >
                Search channels
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                aria-hidden
              />
              <input
                id="glasstv-channel-grid-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search channels..."
                className={cn(
                  'focus-ring bg-card border border-border rounded-xl',
                  'pl-9 pr-4 py-2 text-sm w-full placeholder:text-muted-foreground/70',
                )}
              />
              {search ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted focus-ring"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              ) : null}
            </div>
          ) : null}

          {showFilters ? (
            <div className="flex flex-wrap gap-2 items-center">
              <div
                role="group"
                aria-label="Filter by category"
                className="flex flex-wrap gap-2"
              >
                <CategoryChip
                  label="All"
                  active={category === 'all'}
                  onClick={() => setCategory('all')}
                />
                {categories.map((cat) => (
                  <CategoryChip
                    key={cat}
                    label={cat}
                    active={category === cat}
                    onClick={() => setCategory(cat)}
                  />
                ))}
              </div>

              <div className="ml-auto">
                <label
                  htmlFor="glasstv-channel-grid-language"
                  className="sr-only"
                >
                  Filter by language
                </label>
                <select
                  id="glasstv-channel-grid-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  aria-label="Filter by language"
                  className={cn(
                    'focus-ring bg-card border border-border rounded-lg',
                    'px-3 py-1.5 text-xs font-medium text-foreground/80',
                    'hover:bg-muted transition-colors cursor-pointer',
                  )}
                >
                  <option value="all">All languages</option>
                  {languages.map((lng) => (
                    <option key={lng} value={lng} className="capitalize">
                      {lng}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Results count line. */}
      {!loadingInitial && !error ? (
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? 'No channels found'
            : `${total} channel${total === 1 ? '' : 's'}`}
        </p>
      ) : null}

      {/* Grid / loading / empty states. */}
      {loadingInitial ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <ChannelCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="card-solid rounded-2xl p-10 text-center">
          <p className="text-base font-medium text-foreground">
            Something went wrong
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 focus-ring text-sm font-medium text-primary hover:underline rounded"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : channels.length === 0 ? (
        <div className="card-solid rounded-2xl p-10 text-center">
          <p className="text-5xl mb-2" aria-hidden>
            {'📺'}
          </p>
          <p className="text-base font-medium text-foreground">
            No channels found
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search or category.
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 focus-ring text-sm font-medium text-primary hover:underline rounded"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                favorited={isFavorite(channel.id)}
                onToggleFavorite={() => toggleFavorite(channel.id)}
                onClick={() => handleClick(channel)}
              />
            ))}
          </div>

          {page < totalPages ? (
            <div className="flex justify-center pt-2">
              <GradientButton
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2
                      className="h-4 w-4 mr-2 animate-spin"
                      aria-hidden
                    />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </GradientButton>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
}
