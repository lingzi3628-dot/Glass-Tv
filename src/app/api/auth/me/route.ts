import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireUser, unauthorized } from '@/lib/api-auth'

export async function GET() {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatar: true,
        preferences: { select: { onboardingCompleted: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'user not found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatar: user.avatar,
          onboardingCompleted: user.preferences?.onboardingCompleted ?? false,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/auth/me] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
