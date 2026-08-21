import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireUser, unauthorized } from '@/lib/api-auth'

/**
 * Safely JSON-parse a string into a `string[]`. Used to decode the
 * `preferredGenres` / `preferredLanguages` / `favoriteCategories` columns
 * which are stored as JSON-encoded strings (Prisma SQLite can't store
 * primitive lists).
 *
 * Returns `[]` on any failure (parse error, wrong shape, null) so the
 * frontend never sees a thrown error here.
 */
function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

interface PreferencesData {
  preferredGenres: string[]
  preferredLanguages: string[]
  favoriteCategories: string[]
  viewingTime: string | null
  viewingDevice: string | null
  onboardingCompleted: boolean
}

/**
 * GET /api/preferences
 *
 * Returns the current user's onboarding preferences, decoding the
 * JSON-string array fields (`preferredGenres`, `preferredLanguages`,
 * `favoriteCategories`) into real arrays.
 *
 * Response:
 *   { data: PreferencesData | null }
 *
 * `data` is `null` when the user hasn't completed onboarding yet (no
 * UserPreference row exists).
 */
export async function GET() {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const pref = await db.userPreference.findUnique({
      where: { userId: session.userId },
    })

    if (!pref) {
      return NextResponse.json({ data: null }, { status: 200 })
    }

    const data: PreferencesData = {
      preferredGenres: parseJsonArray(pref.preferredGenres),
      preferredLanguages: parseJsonArray(pref.preferredLanguages),
      favoriteCategories: parseJsonArray(pref.favoriteCategories),
      viewingTime: pref.viewingTime,
      viewingDevice: pref.viewingDevice,
      onboardingCompleted: pref.onboardingCompleted,
    }

    return NextResponse.json({ data }, { status: 200 })
  } catch (err) {
    console.error('[api/preferences] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}
