import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import ZAI from 'z-ai-web-dev-sdk'

import { db } from '@/lib/db'
import { badRequest, requireUser, unauthorized } from '@/lib/api-auth'

/**
 * AI Captions API.
 *
 * POST /api/captions
 *   Body: { audio: string (base64 WAV), channelId: string, timestamp: number (seconds),
 *           language?: string (default 'en') }
 *   - Checks the CaptionsCache first (composite unique on
 *     channelId+timestamp+language); returns the cached transcript if found.
 *   - Otherwise transcribes via the z-ai-web-dev-sdk ASR endpoint and caches
 *     the result. Empty transcriptions are returned but NOT cached.
 *   - ASR SDK failures return 503 with `{ loading: true }` so the frontend
 *     can retry. All other unexpected errors return 500.
 *
 * GET /api/captions?channelId=X&from=0&to=99999&language=en
 *   - Returns the cached captions for a channel in a time range, ordered
 *     by timestamp ascending.
 */

/** Narrowed ASR response shape — the SDK types this as `any`, so we cast via unknown. */
interface AsrResponse {
  text?: unknown
}

interface TranscribeBody {
  audio?: unknown
  channelId?: unknown
  timestamp?: unknown
  language?: unknown
}

/** Lazy singleton so we don't re-init the ZAI client on every request. */
let zaiPromise: Promise<ZAI> | null = null
function getZai(): Promise<ZAI> {
  if (!zaiPromise) zaiPromise = ZAI.create()
  return zaiPromise
}

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

/** Validate a 2-letter language code (lowercase ASCII). */
function isLanguageCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{2}$/.test(value)
}

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const body = (await request.json().catch(() => null)) as TranscribeBody | null
    if (!body) return badRequest('invalid JSON body')

    const audio = typeof body.audio === 'string' ? body.audio.trim() : ''
    const channelId = typeof body.channelId === 'string' ? body.channelId.trim() : ''
    const timestamp =
      typeof body.timestamp === 'number' && Number.isFinite(body.timestamp)
        ? Math.max(0, Math.floor(body.timestamp))
        : null
    const languageRaw = typeof body.language === 'string' ? body.language.trim().toLowerCase() : 'en'
    const language = isLanguageCode(languageRaw) ? languageRaw : 'en'

    if (!audio) return badRequest('audio is required (base64 WAV)')
    if (!channelId) return badRequest('channelId is required')
    if (timestamp === null) return badRequest('timestamp must be a number of seconds')

    // 1. Cache lookup — composite unique on channelId+timestamp+language.
    try {
      const cached = await db.captionsCache.findUnique({
        where: {
          channelId_timestamp_language: { channelId, timestamp, language },
        },
        select: { text: true },
      })
      if (cached) {
        return NextResponse.json(
          { text: cached.text, cached: true, timestamp },
          { status: 200 },
        )
      }
    } catch (err) {
      // Cache lookup failure is non-fatal — fall through to live transcription.
      console.error('[api/captions POST] cache lookup failed', err)
    }

    // 2. Live transcription via the z-ai-web-dev-sdk ASR endpoint.
    let text = ''
    try {
      const zai = await getZai()
      const response = (await zai.audio.asr.create({ file_base64: audio })) as AsrResponse
      const raw = typeof response?.text === 'string' ? response.text : ''
      text = raw.trim()
    } catch (asrErr) {
      // SDK threw (model loading, network, etc.) — surface as a retryable 503.
      const details = errorMessage(asrErr)
      console.error('[api/captions POST] ASR SDK error', details)
      return NextResponse.json(
        {
          error: 'Caption service temporarily unavailable',
          loading: true,
          details,
        },
        { status: 503 },
      )
    }

    // 3. Empty transcriptions are returned but not cached.
    if (!text) {
      return NextResponse.json(
        { text: '', cached: false, timestamp, empty: true },
        { status: 200 },
      )
    }

    // 4. Persist to the cache. Tolerate a P2002 race (another request
    //    transcribed the same segment concurrently) — just return the text.
    try {
      await db.captionsCache.create({
        data: { channelId, timestamp, text, language },
      })
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        // Race condition — another request cached the same segment. Fine.
      } else {
        // Cache write failure shouldn't fail the whole request.
        console.error('[api/captions POST] cache write failed', err)
      }
    }

    return NextResponse.json(
      { text, cached: false, timestamp },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/captions POST] error', err)
    return NextResponse.json(
      { error: 'Transcription failed', details: errorMessage(err) },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const { searchParams } = new URL(request.url)
    const channelId = (searchParams.get('channelId') ?? '').trim()
    const fromRaw = searchParams.get('from')
    const toRaw = searchParams.get('to')
    const languageRaw = (searchParams.get('language') ?? 'en').trim().toLowerCase()
    const language = isLanguageCode(languageRaw) ? languageRaw : 'en'

    if (!channelId) return badRequest('channelId is required')

    const from =
      fromRaw !== null && Number.isFinite(Number(fromRaw))
        ? Math.max(0, Math.floor(Number(fromRaw)))
        : 0
    const to =
      toRaw !== null && Number.isFinite(Number(toRaw))
        ? Math.max(from, Math.floor(Number(toRaw)))
        : Number.MAX_SAFE_INTEGER

    const rows = await db.captionsCache.findMany({
      where: {
        channelId,
        language,
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        channelId: true,
        timestamp: true,
        text: true,
        language: true,
        createdAt: true,
      },
    })

    return NextResponse.json(
      {
        data: rows.map((r) => ({
          id: r.id,
          channelId: r.channelId,
          timestamp: r.timestamp,
          text: r.text,
          language: r.language,
          createdAt: r.createdAt,
        })),
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/captions GET] error', err)
    return NextResponse.json(
      { error: 'Failed to fetch captions', details: errorMessage(err) },
      { status: 500 },
    )
  }
}
