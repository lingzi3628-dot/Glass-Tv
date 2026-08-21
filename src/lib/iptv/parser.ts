/**
 * Self-contained M3U / M3U8 playlist parser for GlassTV.
 *
 * The M3U format is trivial enough that an external dependency
 * (`@iptv/playlist`) is unnecessary — this module covers the subset GlassTV
 * needs and stays under ~150 lines.
 *
 * Format reference:
 *   #EXTM3U                              <- header (optional, ignored)
 *   #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." tvg-country="..."
 *             tvg-language="..." group-title="...",Channel Display Name
 *   https://stream.example/live.m3u8     <- the actual stream URL
 *
 * Each `#EXTINF:` line is followed by exactly one non-comment line that holds
 * the stream URL. Attributes use the `key="value"` form, separated by spaces.
 */
import { createHash } from 'crypto'

export interface ParsedChannel {
  /** Stable id derived from url+name (see generateChannelId). */
  id: string
  name: string
  logoUrl: string | null
  streamUrl: string
  /** From `group-title` attribute. */
  category: string | null
  /** From `tvg-country` attribute. */
  country: string | null
  /** From `tvg-language` attribute. */
  language: string | null
  /** Always false for synced channels — only seeded channels are verified. */
  isVerified: boolean
}

export interface ParseResult {
  channels: ParsedChannel[]
  total: number
  source: string
}

/**
 * Build a deterministic id for a synced channel so re-syncing the same
 * playlist upserts rather than duplicates. Format: `iptv-<slug>-<hash8>`.
 */
export function generateChannelId(url: string, name: string): string {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 8)
  return `iptv-${cleanName || 'channel'}-${hash}`
}

/** Matches `key="value"` pairs inside an #EXTINF line. */
const ATTR_RE = /([\w-]+)="([^"]*)"/g

/**
 * Parse the metadata portion of an `#EXTINF` line.
 *
 * The line looks like:
 *   `#EXTINF:-1 tvg-id="X" tvg-name="Y" tvg-logo="Z" group-title="G",Display Name`
 *
 * Everything before the first comma is metadata; everything after is the
 * display name (which itself may contain commas).
 */
function parseExtinfLine(line: string): {
  attrs: Record<string, string>
  name: string
} {
  // Strip the leading `#EXTINF:` (case-insensitive) so we are left with
  //   `-1 tvg-id="..." ... group-title="...",Display Name`
  const headerIdx = line.indexOf(':')
  const body = headerIdx >= 0 ? line.slice(headerIdx + 1) : line

  // The name follows the FIRST comma. Everything before it is the duration +
  // attributes block.
  const commaIdx = body.indexOf(',')
  const metaPart = commaIdx >= 0 ? body.slice(0, commaIdx) : body
  const namePart = commaIdx >= 0 ? body.slice(commaIdx + 1) : ''

  const attrs: Record<string, string> = {}
  ATTR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = ATTR_RE.exec(metaPart)) !== null) {
    const key = match[1]
    const value = match[2]
    if (key && value) {
      attrs[key] = value
    }
  }

  const name = namePart.trim()
  return {
    attrs,
    name: name || attrs['tvg-name'] || 'Unnamed Channel',
  }
}

/**
 * Parse a full M3U playlist string into a list of `ParsedChannel`s.
 *
 * Implementation notes:
 * - Splits on any of \r\n, \n, or \r (handles Windows/Unix/old-Mac endings).
 * - Iterates line-by-line; on `#EXTINF:` parses attrs + name and remembers
 *   that the NEXT non-empty, non-`#` line is the stream URL.
 * - Skips entries that never receive a stream URL.
 * - Stream URLs are trimmed; whitespace-only lines are skipped.
 */
export function parseM3UPlaylist(
  content: string,
  sourceUrl: string,
): ParseResult {
  const lines = content.split(/\r\n|\n|\r/)
  const channels: ParsedChannel[] = []

  let pending:
    | { attrs: Record<string, string>; name: string }
    | null = null

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    if (!line) continue

    if (line.startsWith('#EXTINF:')) {
      const { attrs, name } = parseExtinfLine(line)
      pending = { attrs, name }
      continue
    }

    // Other directives (#EXTM3U, #EXTGRP, #EXTVLCOPT, etc.) are ignored.
    if (line.startsWith('#')) {
      continue
    }

    // A non-comment, non-empty line — this is a stream URL. If we have a
    // pending #EXTINF entry, attach it. Otherwise skip orphan URLs.
    if (!pending) continue

    const streamUrl = line
    if (!streamUrl) {
      pending = null
      continue
    }

    const name = pending.name
    channels.push({
      id: generateChannelId(streamUrl, name),
      name,
      logoUrl: pending.attrs['tvg-logo'] || null,
      streamUrl,
      category: pending.attrs['group-title'] || null,
      country: pending.attrs['tvg-country'] || null,
      language: pending.attrs['tvg-language'] || null,
      isVerified: false,
    })

    pending = null
  }

  return {
    channels,
    total: channels.length,
    source: sourceUrl,
  }
}

/**
 * Fetch a remote M3U playlist over HTTP and parse it.
 *
 * - 30s hard timeout via AbortSignal.timeout so a hung source doesn't stall
 *   the whole sync.
 * - Custom User-Agent so public mirrors don't 403 us as an "unknown client".
 * - Throws on non-2xx HTTP so the caller can record the URL as failed.
 */
export async function fetchAndParsePlaylist(
  url: string,
): Promise<ParseResult> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'GlassTV/1.0',
      Accept: 'audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*',
    },
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(
      `Failed to fetch playlist ${url}: HTTP ${res.status} ${res.statusText}`,
    )
  }

  const text = await res.text()
  return parseM3UPlaylist(text, url)
}
