import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { badRequest, requireUser, unauthorized } from '@/lib/api-auth'
import {
  getEpisodeStream,
} from '@/lib/short-drama/service'

/**
 * Short Drama watch history.
 *
 * GET  /api/short-drama/history        → the user's 50 most-recent entries
 *                                         (drama + episode info joined).
 * POST /api/short-drama/history        → upsert drama + episode rows and
 *                                         record a watch session.
 *                                         body: {
 *                                           externalId: string,
 *                                           episodeNumber: number,
 *                                           progress?: number,    // seconds
 *                                           completed?: boolean,
 *                                         }
 *
 * All actions require auth.
 */

interface HistoryRowDrama {
  id: number
  externalId: string
  title: string
  description: string | null
  cover: string | null
  poster: string | null
  genre: string | null
  rating: number | null
  totalEpisodes: number
}

interface HistoryRowEpisode {
  id: number
  externalId: string
  episodeNumber: number
  title: string | null
  streamUrl: string
  duration: number | null
  thumbnail: string | null
}

interface HistoryRow {
  id: number
  userId: string
  dramaId: number
  episodeId: number
  watchedAt: Date
  progress: number
  completed: boolean
  drama: HistoryRowDrama
  episode: HistoryRowEpisode
}

export async function GET() {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const rows = (await db.shortDramaHistory.findMany({
      where: { userId: session.userId },
      orderBy: { watchedAt: 'desc' },
      take: 50,
      include: {
        drama: {
          select: {
            id: true,
            externalId: true,
            title: true,
            description: true,
            cover: true,
            poster: true,
            genre: true,
            rating: true,
            totalEpisodes: true,
          },
        },
        episode: {
          select: {
            id: true,
            externalId: true,
            episodeNumber: true,
            title: true,
            streamUrl: true,
            duration: true,
            thumbnail: true,
          },
        },
      },
    })) as HistoryRow[]

    return NextResponse.json(
      {
        history: rows.map((r) => ({
          id: r.id,
          dramaId: r.drama.externalId,
          dramaTitle: r.drama.title,
          dramaCover: r.drama.cover ?? r.drama.poster ?? null,
          dramaGenre: r.drama.genre,
          dramaTotalEpisodes: r.drama.totalEpisodes,
          episodeNumber: r.episode.episodeNumber,
          episodeTitle: r.episode.title,
          streamUrl: r.episode.streamUrl,
          progress: r.progress,
          completed: r.completed,
          watchedAt: r.watchedAt,
        })),
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/short-drama/history GET] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}

interface PostBody {
  externalId?: unknown
  episodeNumber?: unknown
  progress?: unknown
  completed?: unknown
}

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const body = (await request.json().catch(() => null)) as PostBody | null

    const externalId =
      typeof body?.externalId === 'string' ? body.externalId.trim() : ''
    const episodeNumber =
      typeof body?.episodeNumber === 'number'
        ? Math.floor(body.episodeNumber)
        : typeof body?.episodeNumber === 'string'
          ? parseInt(body.episodeNumber, 10)
          : NaN
    const progress =
      typeof body?.progress === 'number' ? Math.max(0, Math.floor(body.progress)) : 0
    const completed =
      typeof body?.completed === 'boolean' ? body.completed : false

    if (!externalId) {
      return badRequest('externalId is required')
    }
    if (!Number.isFinite(episodeNumber) || episodeNumber < 1) {
      return badRequest('episodeNumber must be a positive integer')
    }

    // Resolve the catalog episode so we have authoritative metadata + stream.
    const resolved = await getEpisodeStream(externalId, episodeNumber)
    if (!resolved) {
      return NextResponse.json(
        { error: 'drama or episode not found in catalog' },
        { status: 404 },
      )
    }
    const { drama: detail, episode } = resolved

    // Run the upserts inside a transaction so we never end up with
    // a history row pointing at a half-written drama.
    const result = await db.$transaction(async (tx) => {
      // 1. Upsert the drama row.
      const drama = await tx.shortDrama.upsert({
        where: { externalId },
        update: {
          title: detail.title,
          description: detail.description,
          cover: `emoji:${detail.emoji}`,
          poster: `emoji:${detail.emoji}`,
          genre: detail.genre,
          rating: detail.rating,
          totalEpisodes: detail.totalEpisodes,
          source: 'curated',
        },
        create: {
          externalId,
          title: detail.title,
          description: detail.description,
          cover: `emoji:${detail.emoji}`,
          poster: `emoji:${detail.emoji}`,
          source: 'curated',
          genre: detail.genre,
          rating: detail.rating,
          totalEpisodes: detail.totalEpisodes,
        },
        select: { id: true },
      })

      // 2. Upsert the episode row keyed on (dramaId, episodeNumber).
      const episodeRow = await tx.shortDramaEpisode.upsert({
        where: {
          dramaId_episodeNumber: {
            dramaId: drama.id,
            episodeNumber,
          },
        },
        update: {
          externalId: `${externalId}-ep-${episodeNumber}`,
          title: episode.title ?? null,
          streamUrl: episode.streamUrl,
          duration: episode.duration ?? null,
        },
        create: {
          dramaId: drama.id,
          externalId: `${externalId}-ep-${episodeNumber}`,
          episodeNumber,
          title: episode.title ?? null,
          streamUrl: episode.streamUrl,
          duration: episode.duration ?? null,
        },
        select: { id: true },
      })

      // 3. Insert the watch history row. We deliberately insert a new row
      //    every time (no upsert by user+episode) so the 50-row "recent
      //    history" feed actually reflects recency.
      const history = await tx.shortDramaHistory.create({
        data: {
          userId: session.userId,
          dramaId: drama.id,
          episodeId: episodeRow.id,
          progress,
          completed,
        },
        select: { id: true },
      })

      return { dramaId: drama.id, episodeId: episodeRow.id, historyId: history.id }
    })

    return NextResponse.json(
      { success: true, ...result },
      { status: 201 },
    )
  } catch (err) {
    console.error('[api/short-drama/history POST] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}
