/**
 * Shared helpers for the channel API routes
 * (`/api/channels`, `/api/channels/categories`).
 *
 * Centralizing the distinct-list query + the public projection keeps the
 * response shapes consistent across endpoints and avoids duplicating the
 * "select distinct non-null category list" Prisma dance in two files.
 */
import { db } from '@/lib/db'

export interface ChannelPublic {
  id: string
  name: string
  logoUrl: string | null
  category: string | null
  country: string | null
  language: string | null
  isVerified: boolean
}

/**
 * Project a Prisma channel row into the public shape returned by the list
 * endpoint. `streamUrl` is INTENTIONALLY stripped here — the list endpoint
 * must not leak stream URLs. The single-channel detail endpoint exposes
 * `streamUrl` separately (the user has explicitly picked a channel to watch).
 */
export function toPublic(c: {
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

/**
 * Return distinct non-null `category` values from the Channel table, sorted
 * ascending. We select then filter nulls in JS because Prisma's SQLite
 * `distinct` + `where: { category: { not: null } }` combo returns rows
 * rather than scalars, and this keeps the call sites tiny.
 */
export async function getDistinctCategories(): Promise<string[]> {
  const rows = await db.channel.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
    orderBy: { category: 'asc' },
  })
  return rows
    .map((r) => r.category)
    .filter((c): c is string => Boolean(c))
}

/** Distinct non-null `language` values, sorted ascending. */
export async function getDistinctLanguages(): Promise<string[]> {
  const rows = await db.channel.findMany({
    where: { language: { not: null } },
    select: { language: true },
    distinct: ['language'],
    orderBy: { language: 'asc' },
  })
  return rows
    .map((r) => r.language)
    .filter((l): l is string => Boolean(l))
}
