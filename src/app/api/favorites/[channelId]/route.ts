import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireUser, unauthorized } from '@/lib/api-auth'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const { channelId } = await params

    // Idempotent: deleting a non-existent favorite is not an error.
    await db.favorite.deleteMany({
      where: { userId: session.userId, channelId },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[api/favorites/[channelId] DELETE] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
