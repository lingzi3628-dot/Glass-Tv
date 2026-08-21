/**
 * Shared domain types used across GlassTV views and hooks.
 */

export interface Channel {
  id: string
  name: string
  logoUrl?: string | null
  /** Present only on the single-channel detail endpoint (`/api/channels/[id]`). */
  streamUrl?: string | null
  category?: string | null
  country?: string | null
  language?: string | null
  isVerified?: boolean
}

/** The 8 onboarding genres seeded in scripts/seed.ts. */
export const CHANNEL_CATEGORIES = [
  'sports',
  'news',
  'movies',
  'documentaries',
  'kids',
  'music',
  'lifestyle',
  'international',
] as const

export const CHANNEL_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'hi',
  'ar',
  'pt',
] as const
