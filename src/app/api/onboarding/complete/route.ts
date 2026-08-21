import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { badRequest, requireUser, unauthorized } from '@/lib/api-auth'

interface CompleteBody {
  genres?: unknown
  languages?: unknown
  viewingTime?: unknown
  viewingDevice?: unknown
}

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const body = (await request.json()) as CompleteBody
    const genres = Array.isArray(body.genres)
      ? body.genres.filter((g): g is string => typeof g === 'string')
      : []
    const languages = Array.isArray(body.languages)
      ? body.languages.filter((l): l is string => typeof l === 'string')
      : []
    const viewingTime = typeof body.viewingTime === 'string' ? body.viewingTime : null
    const viewingDevice = typeof body.viewingDevice === 'string' ? body.viewingDevice : null

    if (genres.length === 0 || languages.length === 0) {
      return badRequest('genres and languages are required')
    }

    await db.userPreference.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        preferredGenres: JSON.stringify(genres),
        preferredLanguages: JSON.stringify(languages),
        viewingTime,
        viewingDevice,
        onboardingCompleted: true,
      },
      update: {
        preferredGenres: JSON.stringify(genres),
        preferredLanguages: JSON.stringify(languages),
        viewingTime,
        viewingDevice,
        onboardingCompleted: true,
      },
    })

    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[api/onboarding/complete] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
