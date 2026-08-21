import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireUser, unauthorized } from '@/lib/api-auth'

interface ChannelPublic {
  id: string
  name: string
  logoUrl: string | null
  category: string | null
  country: string | null
  language: string | null
  isVerified: boolean
}

/** Strip the internal streamUrl from a channel before returning to the client. */
function toPublic(c: {
  id: string
  name: string
  logoUrl: string | null
  category: string | null
  country: string | null
  language: string | null
  isVerified: boolean
}): ChannelPublic {
  return {
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl,
    category: c.category,
    country: c.country,
    language: c.language,
    isVerified: c.isVerified,
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')?.trim() || ''
    const language = searchParams.get('language')?.trim() || ''
    const q = searchParams.get('q')?.trim() || ''
    const limitRaw = searchParams.get('limit')
    let limit = 50
    if (limitRaw) {
      const parsed = Number.parseInt(limitRaw, 10)
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 200)
      }
    }

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

    const channels = await db.channel.findMany({
      where,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        category: true,
        country: true,
        language: true,
        isVerified: true,
      },
    })

    return NextResponse.json(
      { channels: channels.map(toPublic) },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/channels] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
