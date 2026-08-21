import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { badRequest, requireUser, unauthorized } from '@/lib/api-auth'

/**
 * Per-user caption styling + language preferences.
 *
 * GET  /api/caption-settings  -> the user's CaptionSetting row (or null)
 * POST /api/caption-settings  -> upsert a partial set of fields
 *   Body (any subset of): {
 *     enabled?: boolean,
 *     language?: string (2-letter code),
 *     fontSize?: number (12-48),
 *     fontColor?: string,
 *     backgroundColor?: string,
 *     position?: 'bottom' | 'middle' | 'top',
 *   }
 */

const VALID_POSITIONS = new Set(['bottom', 'middle', 'top'])

/** Validate a 2-letter language code (lowercase ASCII). */
function isLanguageCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{2}$/.test(value)
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

interface SettingsBody {
  enabled?: unknown
  language?: unknown
  fontSize?: unknown
  fontColor?: unknown
  backgroundColor?: unknown
  position?: unknown
}

/** Validate the partial body and return a clean update payload, or an error string. */
function validateBody(
  body: SettingsBody,
): { data: Partial<{ enabled: boolean; language: string; fontSize: number; fontColor: string; backgroundColor: string; position: string }>; error: string | null } {
  const data: Partial<{
    enabled: boolean
    language: string
    fontSize: number
    fontColor: string
    backgroundColor: string
    position: string
  }> = {}

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== 'boolean') {
      return { data, error: 'enabled must be a boolean' }
    }
    data.enabled = body.enabled
  }

  if (body.language !== undefined) {
    if (!isLanguageCode(body.language)) {
      return { data, error: 'language must be a 2-letter code (e.g. "en")' }
    }
    data.language = body.language
  }

  if (body.fontSize !== undefined) {
    if (
      typeof body.fontSize !== 'number' ||
      !Number.isFinite(body.fontSize) ||
      body.fontSize < 12 ||
      body.fontSize > 48
    ) {
      return { data, error: 'fontSize must be a number between 12 and 48' }
    }
    data.fontSize = Math.floor(body.fontSize)
  }

  if (body.fontColor !== undefined) {
    if (typeof body.fontColor !== 'string' || body.fontColor.trim() === '') {
      return { data, error: 'fontColor must be a non-empty string' }
    }
    data.fontColor = body.fontColor.trim()
  }

  if (body.backgroundColor !== undefined) {
    if (typeof body.backgroundColor !== 'string' || body.backgroundColor.trim() === '') {
      return { data, error: 'backgroundColor must be a non-empty string' }
    }
    data.backgroundColor = body.backgroundColor.trim()
  }

  if (body.position !== undefined) {
    if (typeof body.position !== 'string' || !VALID_POSITIONS.has(body.position)) {
      return { data, error: 'position must be one of: bottom, middle, top' }
    }
    data.position = body.position
  }

  return { data, error: null }
}

export async function GET() {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const row = await db.captionSetting.findUnique({
      where: { userId: session.userId },
      select: {
        enabled: true,
        language: true,
        fontSize: true,
        fontColor: true,
        backgroundColor: true,
        position: true,
      },
    })

    if (!row) {
      return NextResponse.json({ data: null }, { status: 200 })
    }

    return NextResponse.json(
      {
        data: {
          enabled: row.enabled,
          language: row.language,
          fontSize: row.fontSize,
          fontColor: row.fontColor,
          backgroundColor: row.backgroundColor,
          position: row.position,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/caption-settings GET] error', err)
    return NextResponse.json(
      { error: 'Failed to fetch caption settings', details: errorMessage(err) },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const body = (await request.json().catch(() => null)) as SettingsBody | null
    if (!body) return badRequest('invalid JSON body')

    const { data, error } = validateBody(body)
    if (error) return badRequest(error)
    if (Object.keys(data).length === 0) {
      return badRequest('no valid fields provided')
    }

    const updated = await db.captionSetting.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, ...data },
      update: data,
      select: {
        enabled: true,
        language: true,
        fontSize: true,
        fontColor: true,
        backgroundColor: true,
        position: true,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          enabled: updated.enabled,
          language: updated.language,
          fontSize: updated.fontSize,
          fontColor: updated.fontColor,
          backgroundColor: updated.backgroundColor,
          position: updated.position,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/caption-settings POST] error', err)
    return NextResponse.json(
      { error: 'Failed to save caption settings', details: errorMessage(err) },
      { status: 500 },
    )
  }
}
