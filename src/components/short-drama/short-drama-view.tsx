'use client'

import * as React from 'react'
import { useDebounce } from 'use-debounce'
import { motion } from 'framer-motion'
import { Play, Search, Sparkles, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import { GlassInput } from '@/components/glass'
import { FadeIn, LoadingSpinner, ScrollReveal, StaggerGrid } from '@/components/animations'
import { useAppStore } from '@/lib/store/app-store'
import type { ShortDrama } from '@/lib/short-drama/service'

// ─────────────────────────────────────────────────────────────────────
// API response shapes
// ─────────────────────────────────────────────────────────────────────

interface DramasResponse {
  dramas?: ShortDrama[]
  error?: string
}

interface GenresResponse {
  genres?: string[]
  error?: string
}

// ─────────────────────────────────────────────────────────────────────
// Local helpers
// ─────────────────────────────────────────────────────────────────────

function DramaPoster({ emoji, gradient, title }: { emoji: string; gradient: string; title: string }) {
  return (
    <div
      className={cn(
        'relative aspect-[3/4] w-full overflow-hidden rounded-2xl',
        'bg-gradient-to-br',
        gradient,
        'flex items-center justify-center',
        'shadow-lg ring-1 ring-black/5',
      )}
      aria-hidden
    >
      <span className="text-6xl sm:text-7xl drop-shadow-lg" role="img" aria-label={title}>
        {emoji}
      </span>
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    </div>
  )
}

function RatingBadge({ rating }: { rating: number }) {
  return (
    <span
      className={cn(
        'absolute top-2 left-2 z-10',
        'px-2 py-0.5 rounded-full text-[10px] font-bold',
        'bg-yellow-400/95 text-yellow-950 shadow-md',
      )}
    >
      ★ {rating.toFixed(1)}
    </span>
  )
}

function EpisodeCountPill({ count }: { count: number }) {
  return (
    <span
      className={cn(
        'absolute top-2 right-2 z-10',
        'px-2 py-0.5 rounded-full text-[10px] font-semibold',
        'bg-black/60 text-white backdrop-blur-sm',
      )}
    >
      {count} eps
    </span>
  )
}

function NewTag() {
  return (
    <span
      className={cn(
        'absolute bottom-2 left-2 z-10',
        'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider',
        'bg-rose-500 text-white shadow-md',
      )}
    >
      New
    </span>
  )
}

function TrendingTag() {
  return (
    <span
      className={cn(
        'absolute bottom-2 left-2 z-10',
        'px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider',
        'bg-orange-500 text-white shadow-md flex items-center gap-1',
      )}
    >
      <TrendingUp className="h-2.5 w-2.5" aria-hidden />
      Trending
    </span>
  )
}

interface DramaCardProps {
  drama: ShortDrama
  onClick: () => void
}

function DramaCard({ drama, onClick }: DramaCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={cn(
        'group relative block w-full text-left',
        'focus-ring rounded-2xl',
      )}
      aria-label={`Open ${drama.title}`}
    >
      <DramaPoster emoji={drama.emoji} gradient={drama.gradient} title={drama.title} />
      <RatingBadge rating={drama.rating} />
      <EpisodeCountPill count={drama.totalEpisodes} />
      {drama.isNew ? <NewTag /> : drama.isTrending ? <TrendingTag /> : null}

      {/* Hover play overlay */}
      <div
        className={cn(
          'absolute inset-0 z-20 flex items-center justify-center',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          'bg-black/40 rounded-2xl',
        )}
      >
        <span
          className={cn(
            'h-12 w-12 rounded-full',
            'flex items-center justify-center',
            'bg-white/95 text-rose-600 shadow-xl',
          )}
        >
          <Play className="h-5 w-5 fill-current" aria-hidden />
        </span>
      </div>

      {/* Title + genre */}
      <div className="mt-2.5 px-1">
        <p className="font-semibold text-sm text-foreground line-clamp-1">
          {drama.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-1">
          {drama.genre} · {drama.description}
        </p>
      </div>
    </motion.button>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Main view
// ─────────────────────────────────────────────────────────────────────

export function ShortDramaView() {
  const openShortDramaDetail = useAppStore((s) => s.openShortDramaDetail)

  const [query, setQuery] = React.useState('')
  const [debouncedQuery] = useDebounce(query, 400)
  const [activeGenre, setActiveGenre] = React.useState<string | null>(null)

  const [dramas, setDramas] = React.useState<ShortDrama[]>([])
  const [genres, setGenres] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(true)

  // Load genre list once.
  React.useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await fetch('/api/short-drama?action=genres')
        const data = (await res.json()) as GenresResponse
        if (!cancelled && res.ok && data.genres) {
          setGenres(data.genres)
        }
      } catch {
        // ignore — chips just won't render
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch dramas based on search/genre. The ?action= parameter changes
  // depending on which filter is active.
  React.useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (debouncedQuery.trim()) {
          params.set('action', 'search')
          params.set('q', debouncedQuery.trim())
        } else if (activeGenre) {
          params.set('action', 'byGenre')
          params.set('genre', activeGenre)
        } else {
          params.set('action', 'all')
        }
        const res = await fetch(`/api/short-drama?${params.toString()}`)
        const data = (await res.json()) as DramasResponse
        if (!cancelled && res.ok && data.dramas) {
          setDramas(data.dramas)
        } else if (!cancelled) {
          setDramas([])
        }
      } catch {
        if (!cancelled) setDramas([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, activeGenre])

  // Always-visible "trending" rail (independent of search/genre filter).
  const [trending, setTrending] = React.useState<ShortDrama[]>([])
  React.useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const res = await fetch('/api/short-drama?action=trending&limit=4')
        const data = (await res.json()) as DramasResponse
        if (!cancelled && res.ok && data.dramas) {
          setTrending(data.dramas)
        }
      } catch {
        // ignore
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const hasFilter = !!debouncedQuery.trim() || !!activeGenre

  return (
    <div className="space-y-6">
      {/* Hero */}
      <FadeIn delay={0.05}>
        <section
          className={cn(
            'relative overflow-hidden rounded-3xl p-6 sm:p-8',
            'bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400',
            'text-white shadow-xl',
          )}
        >
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-semibold mb-3">
              <Sparkles className="h-3 w-3" aria-hidden />
              Binge-sized mini-series
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Short Dramas
            </h1>
            <p className="mt-2 text-sm sm:text-base text-white/90">
              Bite-sized vertical dramas you can finish in one sitting. Swipe
              through episodes, save your favorites, and never miss a twist.
            </p>
          </div>

          {/* Decorative emoji glyphs */}
          <div className="absolute -right-6 -top-6 text-8xl opacity-20 select-none" aria-hidden>
            💃
          </div>
          <div className="absolute right-20 bottom-2 text-5xl opacity-20 select-none" aria-hidden>
            🎬
          </div>

          {/* Search */}
          <div className="relative z-10 mt-5 max-w-xl">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/60"
                aria-hidden
              />
              <GlassInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dramas, genres, cast…"
                className="pl-9 bg-white/95 border-white/40 text-foreground placeholder:text-foreground/50"
                aria-label="Search short dramas"
              />
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Genre chips */}
      {genres.length > 0 ? (
        <FadeIn delay={0.1}>
          <div className="flex flex-wrap gap-2">
            <GenreChip
              label="All"
              active={activeGenre === null}
              onClick={() => setActiveGenre(null)}
            />
            {genres.map((g) => (
              <GenreChip
                key={g}
                label={g}
                active={activeGenre === g}
                onClick={() => setActiveGenre(g === activeGenre ? null : g)}
              />
            ))}
          </div>
        </FadeIn>
      ) : null}

      {/* Trending rail — hidden while a filter is active */}
      {!hasFilter && trending.length > 0 ? (
        <ScrollReveal direction="up" delay={0.1}>
          <section>
            <div className="flex items-center gap-2 mb-3 mt-2">
              <TrendingUp className="h-5 w-5 text-rose-500" aria-hidden />
              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                Trending Now
              </h2>
            </div>
            <StaggerGrid
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
              staggerDelay={0.07}
            >
              {trending.map((d) => (
                <DramaCard
                  key={d.id}
                  drama={d}
                  onClick={() => openShortDramaDetail(d.id)}
                />
              ))}
            </StaggerGrid>
          </section>
        </ScrollReveal>
      ) : null}

      {/* Main catalog */}
      <ScrollReveal direction="up" delay={0.15}>
        <section>
          <div className="flex items-center justify-between mb-3 mt-2">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              {hasFilter ? 'Results' : 'All Dramas'}
            </h2>
            {!loading && dramas.length > 0 ? (
              <span className="text-xs text-muted-foreground">
                {dramas.length} title{dramas.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" label="Loading dramas…" />
            </div>
          ) : dramas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="text-4xl mb-3" aria-hidden>
                🎭
              </p>
              <p className="text-sm text-muted-foreground">
                {hasFilter
                  ? 'No dramas match your search. Try a different keyword or genre.'
                  : 'No dramas available right now.'}
              </p>
            </div>
          ) : (
            <StaggerGrid
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
              staggerDelay={0.05}
            >
              {dramas.map((d) => (
                <DramaCard
                  key={d.id}
                  drama={d}
                  onClick={() => openShortDramaDetail(d.id)}
                />
              ))}
            </StaggerGrid>
          )}
        </section>
      </ScrollReveal>
    </div>
  )
}

function GenreChip({
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
        'focus-ring px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
        active
          ? 'bg-gradient-to-r from-pink-500 to-orange-400 text-white shadow-md'
          : 'bg-card border border-border text-foreground/80 hover:border-rose-300 hover:text-rose-600',
      )}
    >
      {label}
    </button>
  )
}
