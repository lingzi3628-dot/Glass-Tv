'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Heart,
  ListVideo,
  Play,
  Star,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  GlassButton,
  GlassCard,
  GradientButton,
} from '@/components/glass'
import { FadeIn, LoadingSpinner, ScrollReveal } from '@/components/animations'
import { useAppStore } from '@/lib/store/app-store'
import type {
  ShortDramaDetail,
  ShortDramaEpisode,
} from '@/lib/short-drama/service'

// ─────────────────────────────────────────────────────────────────────
// API response shapes
// ─────────────────────────────────────────────────────────────────────

interface DetailsResponse {
  drama?: ShortDramaDetail
  error?: string
}

interface EpisodesResponse {
  episodes?: ShortDramaEpisode[]
  totalEpisodes?: number
  error?: string
}

interface FavoritesListResponse {
  favoriteIds?: string[]
  error?: string
}

interface FavoriteMutationResponse {
  ok?: boolean
  error?: string
}

// ─────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────

export interface ShortDramaDetailProps {
  dramaId: string
}

export function ShortDramaDetail({ dramaId }: ShortDramaDetailProps) {
  const closeShortDramaDetail = useAppStore((s) => s.closeShortDramaDetail)
  const openShortDramaPlayer = useAppStore((s) => s.openShortDramaPlayer)

  const [drama, setDrama] = React.useState<ShortDramaDetail | null>(null)
  const [episodes, setEpisodes] = React.useState<ShortDramaEpisode[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Favorite state — fetched from /api/short-drama/favorites so multiple
  // tabs stay in sync. Optimistic local mutation on toggle.
  const [favorited, setFavorited] = React.useState(false)
  const [favBusy, setFavBusy] = React.useState(false)

  // Load drama + episodes + favorite status. Re-runs whenever the user
  // opens a different detail page.
  React.useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const [dRes, eRes, fRes] = await Promise.all([
          fetch(`/api/short-drama?action=details&id=${encodeURIComponent(dramaId)}`),
          fetch(`/api/short-drama?action=episodes&id=${encodeURIComponent(dramaId)}`),
          fetch('/api/short-drama/favorites'),
        ])
        const d = (await dRes.json()) as DetailsResponse
        const e = (await eRes.json()) as EpisodesResponse
        const f = (await fRes.json()) as FavoritesListResponse

        if (cancelled) return
        if (dRes.ok && d.drama) {
          setDrama(d.drama)
        } else {
          setError(d.error ?? 'Failed to load drama')
        }
        if (eRes.ok && e.episodes) {
          setEpisodes(e.episodes)
        }
        if (fRes.ok && f.favoriteIds) {
          setFavorited(f.favoriteIds.includes(dramaId))
        }
      } catch {
        if (!cancelled) setError('Network error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [dramaId])

  async function handleToggleFavorite() {
    if (!drama) return
    // Optimistic update.
    const wasFav = favorited
    setFavorited(!wasFav)
    setFavBusy(true)
    try {
      const res = wasFav
        ? await fetch(
            `/api/short-drama/favorites?id=${encodeURIComponent(drama.id)}`,
            { method: 'DELETE' },
          )
        : await fetch('/api/short-drama/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ externalId: drama.id }),
          })
      const data = (await res.json()) as FavoriteMutationResponse
      if (!res.ok || !data.ok) {
        // Revert on failure.
        setFavorited(wasFav)
      }
    } catch {
      setFavorited(wasFav)
    } finally {
      setFavBusy(false)
    }
  }

  function handleStartWatching(episodeNumber?: number) {
    if (!drama) return
    const target = episodes.find((e) => e.episodeNumber === (episodeNumber ?? 1))
    if (!target) return
    openShortDramaPlayer({
      dramaId: drama.id,
      dramaTitle: drama.title,
      episodeNumber: target.episodeNumber,
      totalEpisodes: drama.totalEpisodes,
      streamUrl: target.streamUrl,
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" label="Loading drama…" />
      </div>
    )
  }

  if (error || !drama) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <p className="text-4xl mb-3" aria-hidden>
          🎬
        </p>
        <p className="text-sm text-muted-foreground">
          {error ?? 'This drama is unavailable.'}
        </p>
        <GlassButton
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={closeShortDramaDetail}
        >
          Back to catalog
        </GlassButton>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <FadeIn delay={0.05}>
        <button
          type="button"
          onClick={closeShortDramaDetail}
          className="focus-ring inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          All dramas
        </button>
      </FadeIn>

      {/* Header card */}
      <ScrollReveal direction="up" delay={0.05}>
        <GlassCard
          variant="solid"
          hoverable={false}
          className="p-0 overflow-hidden"
        >
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-0">
            {/* Poster */}
            <div
              className={cn(
                'relative aspect-[3/4] sm:aspect-auto sm:h-full min-h-[260px]',
                'bg-gradient-to-br',
                drama.gradient,
                drama.emoji.startsWith('http') ? '' : 'flex items-center justify-center',
              )}
            >
              {drama.emoji.startsWith('http') ? (
                <img
                  src={drama.emoji}
                  alt={drama.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                   ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ) : (
                <span className="text-7xl sm:text-8xl drop-shadow-lg" role="img" aria-label={drama.title}>
                  {drama.emoji.startsWith('emoji:') ? drama.emoji.slice('emoji:'.length) : drama.emoji}
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
              {drama.isNew ? (
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white shadow-md">
                  New
                </span>
              ) : drama.isTrending ? (
                <span className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500 text-white shadow-md">
                  Trending
                </span>
              ) : null}
            </div>

            {/* Meta */}
            <div className="p-5 sm:p-6 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                    {drama.title}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      {drama.genre}
                    </span>
                    <span className="inline-flex items-center gap-1 text-yellow-600 font-semibold">
                      <Star className="h-3 w-3 fill-current" aria-hidden />
                      {drama.rating.toFixed(1)}
                    </span>
                    <span>·</span>
                    <span>{drama.totalEpisodes} episodes</span>
                    <span>·</span>
                    <span>{drama.year}</span>
                  </div>
                </div>
              </div>

              {/* Synopsis */}
              <p className="mt-4 text-sm sm:text-base text-foreground/80 leading-relaxed line-clamp-6">
                {drama.synopsis}
              </p>

              {/* Cast */}
              {drama.cast.length > 0 ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground/70">Cast: </span>
                  {drama.cast.join(', ')}
                </p>
              ) : null}

              {/* Actions */}
              <div className="mt-auto pt-5 flex flex-wrap gap-2">
                <GradientButton
                  size="md"
                  onClick={() => handleStartWatching(1)}
                  className="bg-gradient-to-r from-pink-500 to-orange-400"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden />
                  Start Watching
                </GradientButton>
                <GlassButton
                  variant="secondary"
                  size="md"
                  onClick={handleToggleFavorite}
                  disabled={favBusy}
                  aria-pressed={favorited}
                >
                  <Heart
                    className={cn(
                      'h-4 w-4',
                      favorited ? 'fill-red-500 text-red-500' : 'text-foreground/70',
                    )}
                    aria-hidden
                  />
                  {favorited ? 'Saved' : 'Save'}
                </GlassButton>
              </div>
            </div>
          </div>
        </GlassCard>
      </ScrollReveal>

      {/* Episodes grid */}
      <ScrollReveal direction="up" delay={0.1}>
        <section>
          <div className="flex items-center gap-2 mb-3 mt-2">
            <ListVideo className="h-5 w-5 text-primary" aria-hidden />
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Episodes
            </h2>
            <span className="text-xs text-muted-foreground">
              {episodes.length} of {drama.totalEpisodes}
            </span>
          </div>

          {episodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No episodes available.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {episodes.map((ep) => (
                <EpisodeRow
                  key={ep.episodeNumber}
                  episode={ep}
                  gradient={drama.gradient}
                  onClick={() => handleStartWatching(ep.episodeNumber)}
                />
              ))}
            </div>
          )}
        </section>
      </ScrollReveal>
    </div>
  )
}

interface EpisodeRowProps {
  episode: ShortDramaEpisode
  gradient: string
  onClick: () => void
}

function EpisodeRow({ episode, gradient, onClick }: EpisodeRowProps) {
  const title = episode.title ?? `Episode ${episode.episodeNumber}`
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className={cn(
        'group focus-ring flex items-center gap-3 p-3 rounded-2xl',
        'bg-card border border-border hover:border-primary/40 transition-colors text-left w-full',
      )}
      aria-label={`Play ${title}`}
    >
      {/* Episode number badge */}
      <div
        className={cn(
          'h-12 w-12 shrink-0 rounded-xl',
          'bg-gradient-to-br',
          gradient,
          'flex items-center justify-center text-white font-bold shadow-md',
        )}
      >
        {episode.episodeNumber}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-foreground truncate">
          {title}
        </p>
        <p className="text-xs text-muted-foreground">
          Episode {episode.episodeNumber}
          {episode.duration ? ` · ${formatDuration(episode.duration)}` : ''}
        </p>
      </div>

      <span
        className={cn(
          'h-9 w-9 shrink-0 rounded-full',
          'flex items-center justify-center',
          'bg-primary/10 text-primary',
          'group-hover:bg-primary group-hover:text-primary-foreground transition-colors',
        )}
      >
        <Play className="h-4 w-4 fill-current" aria-hidden />
      </span>
    </motion.button>
  )
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
