import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { requireUser, unauthorized, badRequest } from '@/lib/api-auth'
import { DEFAULT_SOURCES } from '@/lib/iptv/sources'
import { fetchAndParsePlaylist, type ParsedChannel } from '@/lib/iptv/parser'

// Large playlists can take a while to fetch + upsert. Allow up to 5 minutes
// (Next 16 vercel-style function timeout, also respected by the Node runtime).
export const maxDuration = 300

/** Per-source hard cap to keep a single sync from blowing past the timeout. */
const MAX_CHANNELS_PER_SOURCE = 500

interface SyncBody {
  sources?: unknown
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

interface SyncStats {
  totalChannels: number
  newChannels: number
  updatedChannels: number
  failedSources: string[]
  sourcesProcessed: number
}

/**
 * Upsert a single parsed channel into the DB.
 *
 * Returns `'created'` when the row was newly inserted, `'updated'` when an
 * existing row was touched. We use `upsert` (instead of createMany) because:
 *   1. We need per-row create-vs-update accounting.
 *   2. The channel id is a deterministic function of (url, name), so re-sync
 *      naturally de-dupes — `upsert` makes that explicit.
 */
async function upsertChannel(channel: ParsedChannel): Promise<'created' | 'updated'> {
  const existing = await db.channel.findUnique({
    where: { id: channel.id },
    select: { id: true },
  })

  await db.channel.upsert({
    where: { id: channel.id },
    create: {
      id: channel.id,
      name: channel.name,
      logoUrl: channel.logoUrl,
      streamUrl: channel.streamUrl,
      category: channel.category,
      country: channel.country,
      language: channel.language,
      isVerified: false,
    },
    update: {
      name: channel.name,
      logoUrl: channel.logoUrl,
      streamUrl: channel.streamUrl,
      category: channel.category,
      country: channel.country,
      language: channel.language,
    },
  })

  return existing ? 'updated' : 'created'
}

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    // Parse body defensively — `sources` is optional and must be string[].
    let body: SyncBody = {}
    try {
      body = (await request.json()) as SyncBody
    } catch {
      // Empty body is fine — we fall back to DEFAULT_SOURCES.
      body = {}
    }

    let sources: string[]
    if (body.sources === undefined || body.sources === null) {
      sources = DEFAULT_SOURCES
    } else if (isStringArray(body.sources)) {
      if (body.sources.length === 0) {
        return badRequest('sources must contain at least one URL')
      }
      sources = body.sources
    } else {
      return badRequest('sources must be an array of strings')
    }

    const stats: SyncStats = {
      totalChannels: 0,
      newChannels: 0,
      updatedChannels: 0,
      failedSources: [],
      sourcesProcessed: 0,
    }

    for (const url of sources) {
      try {
        const result = await fetchAndParsePlaylist(url)
        stats.sourcesProcessed += 1

        let processed = 0
        for (const channel of result.channels) {
          if (processed >= MAX_CHANNELS_PER_SOURCE) {
            console.warn(
              `[api/channels/sync] source ${url} exceeded ${MAX_CHANNELS_PER_SOURCE} channels — truncating`,
            )
            break
          }
          const outcome = await upsertChannel(channel)
          if (outcome === 'created') {
            stats.newChannels += 1
          } else {
            stats.updatedChannels += 1
          }
          stats.totalChannels += 1
          processed += 1
        }
      } catch (err) {
        // The sandbox often has no outbound internet to githubusercontent.com.
        // Record the URL as failed but keep iterating other sources.
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[api/channels/sync] source ${url} failed:`, message)
        stats.failedSources.push(url)
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Channel sync completed',
        data: {
          totalChannels: stats.totalChannels,
          newChannels: stats.newChannels,
          updatedChannels: stats.updatedChannels,
          failedSources: stats.failedSources,
          sourcesProcessed: stats.sourcesProcessed,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/channels/sync] error', err)
    return NextResponse.json(
      { error: 'internal server error' },
      { status: 500 },
    )
  }
}
