import { NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

import { db } from '@/lib/db'
import type { Channel } from '@prisma/client'
import { badRequest, requireUser, unauthorized } from '@/lib/api-auth'

interface RecBody {
  genres?: unknown
  languages?: unknown
  viewingTime?: unknown
  viewingDevice?: unknown
}

interface LlmRecommendation {
  channelIds: string[]
  reasons: Record<string, string>
}

const MIN_RECS = 4
const MAX_RECS = 8

/** Strip markdown code fences (```json ... ```) and extract the JSON object. */
function extractJson(raw: string): string {
  let text = raw.trim()
  // Remove leading ```json or ``` and trailing ```
  const fenceStart = text.indexOf('```')
  if (fenceStart !== -1) {
    const afterFence = text.slice(fenceStart + 3)
    // Drop an optional language tag like "json"
    const newlineIdx = afterFence.indexOf('\n')
    if (newlineIdx !== -1) afterFence.slice(newlineIdx + 1)
    const endFence = afterFence.lastIndexOf('```')
    const inner = endFence !== -1 ? afterFence.slice(0, endFence) : afterFence
    text = inner.trim()
  }
  // Fallback: keep only the outermost {...} block.
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1)
  }
  return text
}

function parseLlmResponse(raw: string | null | undefined): LlmRecommendation | null {
  if (!raw) return null
  try {
    const jsonText = extractJson(raw)
    const parsed = JSON.parse(jsonText) as Partial<LlmRecommendation>
    if (!parsed || !Array.isArray(parsed.channelIds)) return null
    const ids = parsed.channelIds
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean)
    const reasons =
      parsed.reasons && typeof parsed.reasons === 'object'
        ? (parsed.reasons as Record<string, unknown>)
        : {}
    const cleanReasons: Record<string, string> = {}
    for (const [k, v] of Object.entries(reasons)) {
      if (typeof v === 'string') cleanReasons[k] = v
    }
    return { channelIds: ids, reasons: cleanReasons }
  } catch {
    return null
  }
}

/**
 * Deterministic fallback when the LLM is unavailable or returns garbage.
 * Picks channels matching the user's preferred genres + languages, then
 * fills remaining slots with verified channels from the catalog.
 */
function deterministicFallback(
  channels: Channel[],
  genres: string[],
  languages: string[],
): LlmRecommendation {
  const genreSet = new Set(genres.map((g) => g.toLowerCase()))
  const langSet = new Set(languages.map((l) => l.toLowerCase()))

  const matchGenre = (c: Channel) => c.category && genreSet.has(c.category.toLowerCase())
  const matchLang = (c: Channel) => c.language && langSet.has(c.language.toLowerCase())

  const both = channels.filter((c) => matchGenre(c) && matchLang(c))
  const genreOnly = channels.filter((c) => matchGenre(c) && !matchLang(c))
  const langOnly = channels.filter((c) => !matchGenre(c) && matchLang(c))
  const verifiedRest = channels.filter((c) => !matchGenre(c) && !matchLang(c) && c.isVerified)
  const rest = channels.filter((c) => !matchGenre(c) && !matchLang(c) && !c.isVerified)

  const ordered = [...both, ...genreOnly, ...langOnly, ...verifiedRest, ...rest]
  const picked = ordered.slice(0, MAX_RECS)

  // Guarantee at least MIN_RECS even on tiny catalogs.
  while (picked.length < MIN_RECS && ordered.length > picked.length) {
    picked.push(ordered[picked.length])
  }

  const channelIds = picked.map((c) => c.id)
  const reasons: Record<string, string> = {}
  for (const c of picked) {
    if (matchGenre(c) && matchLang(c)) {
      reasons[c.id] = `Matches your favorite ${c.category} content in ${c.language}.`
    } else if (matchGenre(c)) {
      reasons[c.id] = `A top ${c.category} pick for fans of the genre.`
    } else if (matchLang(c)) {
      reasons[c.id] = `Available in ${c.language}, one of your preferred languages.`
    } else {
      reasons[c.id] = `A verified, crowd-favorite channel worth trying.`
    }
  }

  return { channelIds, reasons }
}

async function callLlm(
  systemPrompt: string,
  userPrompt: string,
): Promise<LlmRecommendation | null> {
  try {
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      thinking: { type: 'disabled' },
    })
    const text = completion.choices[0]?.message?.content
    return parseLlmResponse(text)
  } catch (err) {
    console.error('[api/onboarding/recommendations] LLM call failed', err)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireUser()
    if (!session) return unauthorized()

    const body = (await request.json()) as RecBody
    const genres = Array.isArray(body.genres)
      ? body.genres.filter((g): g is string => typeof g === 'string')
      : []
    const languages = Array.isArray(body.languages)
      ? body.languages.filter((l): l is string => typeof l === 'string')
      : []
    const viewingTime = typeof body.viewingTime === 'string' ? body.viewingTime : ''
    const viewingDevice = typeof body.viewingDevice === 'string' ? body.viewingDevice : ''

    if (genres.length === 0 || languages.length === 0) {
      return badRequest('genres and languages are required')
    }

    const channels = await db.channel.findMany()
    if (channels.length === 0) {
      return NextResponse.json({ channelIds: [], reasons: {} }, { status: 200 })
    }

    const catalog = channels.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category ?? '',
      language: c.language ?? '',
      country: c.country ?? '',
    }))

    const systemPrompt =
      "You are GlassTV's recommendation engine. Given a user's preferences and a catalog of TV channels, " +
      'return ONLY a JSON object with two keys: `channelIds` (array of channel ids from the catalog, ' +
      'ordered by best match, max 8) and `reasons` (object mapping channelId -> a short one-sentence ' +
      'reason in the user\'s most preferred language). No prose outside the JSON.'

    const userPrompt =
      `User preferences:\n` +
      `  - Genres: ${JSON.stringify(genres)}\n` +
      `  - Languages: ${JSON.stringify(languages)}\n` +
      `  - Preferred viewing time: ${viewingTime || 'unspecified'}\n` +
      `  - Preferred viewing device: ${viewingDevice || 'unspecified'}\n\n` +
      `Channel catalog (JSON):\n${JSON.stringify(catalog)}\n\n` +
      `Return the JSON object now.`

    let rec = await callLlm(systemPrompt, userPrompt)

    // Validate the LLM result against the real catalog and clamp the count.
    if (rec) {
      const validIds = new Set(channels.map((c) => c.id))
      rec.channelIds = rec.channelIds.filter((id) => validIds.has(id)).slice(0, MAX_RECS)
      if (rec.channelIds.length < MIN_RECS) {
        rec = null
      }
    }

    if (!rec) {
      rec = deterministicFallback(channels, genres, languages)
    }

    return NextResponse.json(
      { channelIds: rec.channelIds, reasons: rec.reasons },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/onboarding/recommendations] error', err)
    // Last-resort fallback so the frontend never sees a 500 here.
    try {
      const channels = await db.channel.findMany({ take: MAX_RECS })
      const channelIds = channels.slice(0, MIN_RECS).map((c) => c.id)
      const reasons: Record<string, string> = {}
      for (const id of channelIds) {
        reasons[id] = 'A popular channel to get you started.'
      }
      return NextResponse.json({ channelIds, reasons }, { status: 200 })
    } catch {
      return NextResponse.json({ error: 'internal server error' }, { status: 500 })
    }
  }
}
