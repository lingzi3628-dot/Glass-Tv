import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireUser, unauthorized, badRequest } from '@/lib/api-auth'

/**
 * Watch history API.
 *
 * GET  /api/history         -> the user's 50 most-recent watch entries
 *                              (channel info joined). Used by the Home
 *                              "Continue Watching" rail.
 * POST /api/history         -> record a watch session. Body:
 *                              { channelId: string, durationSeconds?: number }
 *                              Called by the Player on unmount / periodically
 *                              so the user can resume where they left off.
 */
export async function GET() {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const history = await db.watchHistory.findMany({
      where: { userId: session.userId },
      orderBy: { watchedAt: 'desc' },
      take: 50,
      include: {
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

    return NextResponse.json(
      {
        data: history.map((h) => ({
          id: h.id,
          channelId: h.channelId,
          watchedAt: h.watchedAt,
          durationSeconds: h.durationSeconds,
          channel: h.channel,
        })),
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/history GET] error', err)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const body = (await request.json().catch(() => null)) as {
      channelId?: unknown
      durationSeconds?: unknown
    } | null

    if (!body?.channelId || typeof body.channelId !== 'string') {
      return badRequest('channelId is required')
    }

    const durationSeconds =
      typeof body.durationSeconds === 'number'
        ? Math.max(0, Math.floor(body.durationSeconds))
        : 0

    // Verify the channel exists (don't record history for deleted channels).
    const channel = await db.channel.findUnique({
      where: { id: body.channelId },
      select: { id: true },
    })
    if (!channel) {
      return badRequest('channel not found')
    }

    const entry = await db.watchHistory.create({
      data: {
        userId: session.userId,
        channelId: body.channelId,
        durationSeconds,
        watchedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, id: entry.id }, { status: 201 })
  } catch (err) {
    console.error('[api/history POST] error', err)
    return NextResponse.json(
      { error: 'Failed to save history' },
      { status: 500 },
    )
  }
}
