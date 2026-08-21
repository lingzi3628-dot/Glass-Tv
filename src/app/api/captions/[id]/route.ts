import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'

import { db } from '@/lib/db'
import { requireUser, unauthorized } from '@/lib/api-auth'

/**
 * DELETE /api/captions/[id]
 *   - Deletes a single CaptionsCache entry by its auto-increment id.
 *   - Returns 200 on success, 404 if the entry doesn't exist.
 *
 * This is a low-risk admin operation — any authenticated user may delete a
 * cached caption (e.g. to force a re-transcription). There is no per-channel
 * ownership check; the cache is global and shared across users.
 */

/** Extract a human-readable string from any error. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'unknown error'
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const { id: idStr } = await params
    const id = Number(idStr)
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: 'invalid caption id' },
        { status: 400 },
      )
    }

    try {
      await db.captionsCache.delete({ where: { id } })
    } catch (err) {
      // Prisma P2025 = record not found.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return NextResponse.json(
          { error: 'caption not found' },
          { status: 404 },
        )
      }
      throw err
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[api/captions/[id] DELETE] error', err)
    return NextResponse.json(
      { error: 'Failed to delete caption', details: errorMessage(err) },
      { status: 500 },
    )
  }
}
