import { NextResponse } from 'next/server'

import { requireUser, unauthorized, badRequest } from '@/lib/api-auth'
import {
  getAllDramas,
  getAvailableGenres,
  getDramaDetails,
  getDramaEpisodes,
  getDramasByGenre,
  getEpisodeStream,
  getNewDramas,
  getTrendingDramas,
  searchDramas,
} from '@/lib/short-drama/service'

/**
 * Short Dramas catalog API.
 *
 * This is a read-only endpoint over the curated catalog in
 * `src/lib/short-drama/service.ts`. The Anichin/DramaBox upstream trial
 * key returns {"error":"forbidden"}, so we deliberately do not call it.
 *
 * Actions (passed via ?action=...):
 *   - trending   → trending dramas (optional ?limit=N)
 *   - new        → new dramas (optional ?limit=N)
 *   - all        → full catalog
 *   - genres     → distinct genre list
 *   - byGenre    → ?genre=Romance
 *   - search     → ?q=...
 *   - details    → ?id=...
 *   - episodes   → ?id=...
 *   - stream     → ?id=...&episode=N
 *
 * All actions require an authenticated session.
 */
export async function GET(request: Request) {
  const session = await requireUser()
  if (!session) return unauthorized()

  const url = new URL(request.url)
  const action = (url.searchParams.get('action') ?? 'all').toLowerCase()

  try {
    switch (action) {
      case 'trending': {
        const limit = parseLimit(url.searchParams.get('limit'))
        return NextResponse.json(
          { dramas: getTrendingDramas(limit) },
          { status: 200 },
        )
      }
      case 'new': {
        const limit = parseLimit(url.searchParams.get('limit'))
        return NextResponse.json(
          { dramas: getNewDramas(limit) },
          { status: 200 },
        )
      }
      case 'all': {
        return NextResponse.json(
          { dramas: getAllDramas() },
          { status: 200 },
        )
      }
      case 'genres': {
        return NextResponse.json(
          { genres: getAvailableGenres() },
          { status: 200 },
        )
      }
      case 'bygenre': {
        const genre = url.searchParams.get('genre') ?? ''
        if (!genre.trim()) {
          return badRequest('genre is required for action=byGenre')
        }
        return NextResponse.json(
          { dramas: getDramasByGenre(genre) },
          { status: 200 },
        )
      }
      case 'search': {
        const q = url.searchParams.get('q') ?? ''
        return NextResponse.json(
          { dramas: searchDramas(q), query: q },
          { status: 200 },
        )
      }
      case 'details': {
        const id = url.searchParams.get('id') ?? ''
        if (!id.trim()) return badRequest('id is required for action=details')
        const drama = getDramaDetails(id)
        if (!drama) {
          return NextResponse.json(
            { error: 'drama not found' },
            { status: 404 },
          )
        }
        return NextResponse.json({ drama }, { status: 200 })
      }
      case 'episodes': {
        const id = url.searchParams.get('id') ?? ''
        if (!id.trim()) return badRequest('id is required for action=episodes')
        const drama = getDramaDetails(id)
        if (!drama) {
          return NextResponse.json(
            { error: 'drama not found' },
            { status: 404 },
          )
        }
        return NextResponse.json(
          { episodes: getDramaEpisodes(id), totalEpisodes: drama.totalEpisodes },
          { status: 200 },
        )
      }
      case 'stream': {
        const id = url.searchParams.get('id') ?? ''
        const epRaw = url.searchParams.get('episode')
        if (!id.trim()) return badRequest('id is required for action=stream')
        const episodeNumber = epRaw ? parseInt(epRaw, 10) : NaN
        if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
          return badRequest('episode (positive integer) is required for action=stream')
        }
        const result = getEpisodeStream(id, episodeNumber)
        if (!result) {
          return NextResponse.json(
            { error: 'episode not found' },
            { status: 404 },
          )
        }
        return NextResponse.json(
          {
            streamUrl: result.streamUrl,
            episode: result.episode,
            drama: {
              id: result.drama.id,
              title: result.drama.title,
              totalEpisodes: result.drama.totalEpisodes,
              gradient: result.drama.gradient,
            },
          },
          { status: 200 },
        )
      }
      default:
        return badRequest(`unknown action: ${action}`)
    }
  } catch (err) {
    console.error('[api/short-drama GET] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}

/** Parse a ?limit= query string into a positive integer or undefined. */
function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return n
}
