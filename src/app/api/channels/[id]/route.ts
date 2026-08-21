import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireUser, unauthorized } from '@/lib/api-auth'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const { id } = await params
    const channel = await db.channel.findUnique({
      where: { id },
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

    if (!channel) {
      return NextResponse.json({ error: 'channel not found' }, { status: 404 })
    }

    // streamUrl is intentionally excluded.
    return NextResponse.json({ channel }, { status: 200 })
  } catch (err) {
    console.error('[api/channels/[id]] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
