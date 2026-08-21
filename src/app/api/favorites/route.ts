import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { badRequest, requireUser, unauthorized } from '@/lib/api-auth'

interface FavoriteBody {
  channelId?: unknown
}

export async function GET() {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const favorites = await db.favorite.findMany({
      where: { userId: session.userId },
      orderBy: { addedAt: 'desc' },
      select: {
        channel: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            category: true,
            country: true,
            language: true,
            isVerified: true,
          },
        },
      },
    })

    // streamUrl is intentionally stripped.
    const channels = favorites.map((f) => f.channel)
    return NextResponse.json({ channels }, { status: 200 })
  } catch (err) {
    console.error('[api/favorites GET] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const body = (await request.json()) as FavoriteBody
    const channelId = typeof body.channelId === 'string' ? body.channelId.trim() : ''

    if (!channelId) {
      return badRequest('channelId is required')
    }

    const channel = await db.channel.findUnique({ where: { id: channelId } })
    if (!channel) {
      return NextResponse.json({ error: 'channel not found' }, { status: 404 })
    }

    try {
      await db.favorite.create({
        data: { userId: session.userId, channelId },
      })
    } catch (err) {
      // Prisma P2002 = unique constraint violation (already favorited) -> idempotent.
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
    console.error('[api/favorites POST] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
