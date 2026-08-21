import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireUser, unauthorized } from '@/lib/api-auth'
import {
  toPublic,
  getDistinctCategories,
  getDistinctLanguages,
} from '@/lib/channels'

/**
 * GET /api/channels
 *
 * Query params (all optional):
 *   ?category=<slug>     Filter by exact category match.
 *   ?language=<code>     Filter by exact language match.
 *   ?q=<substring>       Case-insensitive contains on name (SQLite default).
 *   ?page=<N>            1-based page index (default 1).
 *   ?limit=<N>           Page size (default 50, capped at 200).
 *   ?sort=name|updatedAt Sort key (default `name`).
 *   ?order=asc|desc      Sort direction (default `asc`).
 *
 * Response shape (additive on top of the original `{ channels: [...] }`
 * contract — existing callers that only read `data.channels` keep working):
 *   {
 *     channels: ChannelPublic[],
 *     pagination: { page, limit, total, totalPages },
 *     categories: string[],   // distinct non-null categories, sorted
 *     languages: string[],    // distinct non-null languages, sorted
 *   }
 *
 * `streamUrl` is intentionally NOT included on the list endpoint.
 */
export async function GET(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')?.trim() || ''
    const language = searchParams.get('language')?.trim() || ''
    const q = searchParams.get('q')?.trim() || ''

    // ---- Pagination -------------------------------------------------------
    const pageRaw = searchParams.get('page')
    let page = 1
    if (pageRaw) {
      const parsed = Number.parseInt(pageRaw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) page = parsed
    }

    const limitRaw = searchParams.get('limit')
    let limit = 50
    if (limitRaw) {
      const parsed = Number.parseInt(limitRaw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 200)
      }
    }
    const offset = (page - 1) * limit

    // ---- Sort -------------------------------------------------------------
    const sortRaw = (searchParams.get('sort') || 'name').trim()
    const sortKey: 'name' | 'updatedAt' =
      sortRaw === 'updatedAt' ? 'updatedAt' : 'name'
    const orderRaw = (searchParams.get('order') || 'asc').trim().toLowerCase()
    const orderDir: 'asc' | 'desc' = orderRaw === 'desc' ? 'desc' : 'asc'

    // Prisma + SQLite doesn't have full mode-insensitive contains, but
    // SQLite's `contains` is case-insensitive by default for ASCII.
    const where: {
      category?: string
      language?: string
      name?: { contains: string }
    } = {}
    if (category) where.category = category
    if (language) where.language = language
    if (q) where.name = { contains: q }

    // Run the page query, the count, and the two distinct queries in parallel
    // — they're independent and this shaves a round-trip off the response.
    const [channels, total, categories, languages] = await Promise.all([
      db.channel.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { [sortKey]: orderDir },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          category: true,
          country: true,
          language: true,
          isVerified: true,
        },
      }),
      db.channel.count({ where }),
      getDistinctCategories(),
      getDistinctLanguages(),
    ])

    const totalPages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1

    return NextResponse.json(
      {
        channels: channels.map(toPublic),
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        categories,
        languages,
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/channels] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}
