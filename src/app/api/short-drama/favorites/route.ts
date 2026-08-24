import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { badRequest, requireUser, unauthorized } from '@/lib/api-auth'
import { getDramaDetails } from '@/lib/short-drama/service'

/**
 * Short Drama favorites.
 *
 * GET    /api/short-drama/favorites        → list favorites (with drama details)
 * POST   /api/short-drama/favorites        → add favorite by externalId
 *        body: { externalId: string }
 * DELETE /api/short-drama/favorites?id=...  → remove favorite by externalId
 *
 * All actions require auth.
 *
 * Because the catalog lives in code (not the DB), we upsert the matching
 * ShortDrama row on the fly when a user favorites one. The episodes are
 * persisted lazily by the history endpoint.
 */

interface FavoriteDramaSummary {
  externalId: string
  title: string
  description: string | null
  cover: string | null
  poster: string | null
  genre: string | null
  rating: number | null
  totalEpisodes: number
}

interface FavoriteRow {
  drama: {
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
  addedAt: Date
}

export async function GET() {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const rows = await db.shortDramaFavorite.findMany({
      where: { userId: session.userId },
      orderBy: { addedAt: 'desc' },
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
      },
    })

    const dramas: FavoriteDramaSummary[] = (rows as FavoriteRow[]).map((r) => ({
      externalId: r.drama.externalId,
      title: r.drama.title,
      description: r.drama.description,
      cover: r.drama.cover,
      poster: r.drama.poster,
      genre: r.drama.genre,
      rating: r.drama.rating,
      totalEpisodes: r.drama.totalEpisodes,
    }))

    return NextResponse.json(
      {
        dramas,
        // Plain list of externalIds for quick Set lookups in the UI.
        favoriteIds: dramas.map((d) => d.externalId),
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/short-drama/favorites GET] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}

interface PostBody {
  externalId?: unknown
}

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const body = (await request.json().catch(() => null)) as PostBody | null
    const externalId =
      typeof body?.externalId === 'string' ? body.externalId.trim() : ''

    if (!externalId) {
      return badRequest('externalId is required')
    }

    // Resolve from the in-code catalog so we have canonical metadata.
    const detail = await getDramaDetails(externalId)
    if (!detail) {
      return NextResponse.json(
        { error: 'drama not found in catalog' },
        { status: 404 },
      )
    }

    // Upsert the drama row. The catalog id (e.g. "married-by-mistake")
    // becomes the externalId in the DB.
    const drama = await db.shortDrama.upsert({
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

    try {
      await db.shortDramaFavorite.create({
        data: { userId: session.userId, dramaId: drama.id },
      })
    } catch (err) {
      // P2002 = unique constraint violation (already favorited) → idempotent.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return NextResponse.json(
          { ok: true, alreadyFavorited: true },
          { status: 200 },
        )
      }
      throw err
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('[api/short-drama/favorites POST] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const url = new URL(request.url)
    const externalId = (url.searchParams.get('id') ?? '').trim()

    if (!externalId) {
      return badRequest('id (externalId) query param is required')
    }

    // Resolve the drama row (don't create it on delete — only fetch).
    const drama = await db.shortDrama.findUnique({
      where: { externalId },
      select: { id: true },
    })
    if (!drama) {
      // Nothing to remove — treat as already-removed for idempotency.
      return NextResponse.json({ ok: true, notFound: true }, { status: 200 })
    }

    try {
      await db.shortDramaFavorite.delete({
        where: {
          userId_dramaId: {
            userId: session.userId,
            dramaId: drama.id,
          },
        },
      })
    } catch (err) {
      // P2025 = record not found → idempotent delete.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return NextResponse.json(
          { ok: true, alreadyRemoved: true },
          { status: 200 },
        )
      }
      throw err
    }

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[api/short-drama/favorites DELETE] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}
