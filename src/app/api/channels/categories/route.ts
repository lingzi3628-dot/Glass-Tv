import { NextResponse } from 'next/server'

import { requireUser, unauthorized } from '@/lib/api-auth'
import {
  getDistinctCategories,
  getDistinctLanguages,
} from '@/lib/channels'

/**
 * GET /api/channels/categories
 *
 * Lightweight endpoint for filter UIs that don't want to load the full
 * channel list. Returns the distinct non-null categories + languages in
 * the catalog. Reuses the same distinct-query helpers as the main
 * `/api/channels` endpoint so the two stay in sync.
 *
 * Response: `{ categories: string[], languages: string[] }`
 */
export async function GET() {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const [categories, languages] = await Promise.all([
      getDistinctCategories(),
      getDistinctLanguages(),
    ])

    return NextResponse.json(
      { categories, languages },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/channels/categories] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}
