# Task 2-A — Phase 2 backend (IPTV integration + sync + extended APIs)

**Agent**: full-stack-developer (Phase 2 backend)
**Date**: phase 2 build
**Status**: complete, lint passes (0 errors / 0 warnings), tsc clean for src/

## Files produced / modified

### NEW (7)
- `src/lib/iptv/sources.ts` — `IPTVSource` interface + `IPTV_SOURCES` array
  (iptv-org global/english, Free-TV Global, World IPTV) + `DEFAULT_SOURCES`
  exported as `string[]` for the sync API default.
- `src/lib/iptv/parser.ts` — self-contained M3U parser (no
  `@iptv/playlist` dep). Exports `ParsedChannel`, `ParseResult`,
  `generateChannelId(url, name)` (SHA1-hashed slug `iptv-<slug>-<hash8>`),
  `parseM3UPlaylist(content, sourceUrl)` (splits on any newline, parses
  `#EXTINF:` attrs via `key="value"` regex, takes the next non-comment line as
  the stream URL, skips entries without a URL), and
  `fetchAndParsePlaylist(url)` (fetch with `User-Agent: GlassTV/1.0` +
  `AbortSignal.timeout(30_000)` + `cache: 'no-store'`, throws on non-2xx).
- `src/app/api/channels/sync/route.ts` — POST sync. `maxDuration = 300`.
  Requires auth. Body `{ sources?: string[] }` (defaults to
  `DEFAULT_SOURCES`, validated via `isStringArray` guard). For each source:
  fetch+parse, then per-channel `upsert` (findUnique-then-upsert so we can
  count `'created'` vs `'updated'`). Per-source cap of 500 channels with a
  console warning. On ANY per-source failure, logs + appends URL to
  `failedSources` and continues. Always returns 200 with
  `{ success, message, data: { totalChannels, newChannels, updatedChannels,
  failedSources, sourcesProcessed } }` — never 500, so the sandbox having no
  outbound internet to githubusercontent.com degrades gracefully.
- `src/app/api/channels/categories/route.ts` — GET lightweight endpoint
  returning just the distinct non-null categories + languages. Requires
  auth. Reuses the shared `getDistinctCategories` / `getDistinctLanguages`
  helpers from `src/lib/channels.ts`.
- `src/app/api/preferences/route.ts` — GET returns the user's
  `UserPreference` row with the JSON-string array fields decoded into real
  arrays via `parseJsonArray(str): string[]` (returns `[]` on any failure,
  uses `unknown` + type guards — no `any`). Response `{ data: PreferencesData
  | null }` (`null` when no preference row exists yet).
- `src/lib/channels.ts` — shared `ChannelPublic` interface + `toPublic()`
  projection (strips `streamUrl`) + `getDistinctCategories()` /
  `getDistinctLanguages()` Prisma helpers. Used by both `/api/channels` and
  `/api/channels/categories` so the distinct-list query is defined once.

### MODIFIED (2)
- `src/app/api/channels/route.ts` — extended the GET handler:
  - Added `?page` (1-based, default 1), `?limit` (default 50, capped at 200)
    pagination with `offset = (page-1) * limit`.
  - Added `?sort=name|updatedAt` (default `name`) + `?order=asc|desc`
    (default `asc`).
  - Response is now `{ channels, pagination: { page, limit, total,
    totalPages }, categories: string[], languages: string[] }`. The
    `channels` array stays in the same shape and position so existing
    callers (`data.channels`) keep working — the new fields are additive.
  - Runs the page query, `count`, and both distinct queries via
    `Promise.all` so we make one round-trip instead of four.
  - Still strips `streamUrl` (only the single-channel detail endpoint
    exposes it).
- `src/app/api/channels/[id]/route.ts` — added `streamUrl: true` to the
  Prisma `select` so the single-channel response now includes the stream
  URL. The detail endpoint exposes it because the user has explicitly
  picked a channel to watch (the player/preview popup needs the URL).
  Auth still required; 404 still returned if not found.

## Endpoints exposed (Phase 2 backend)

- `POST /api/channels/sync` -> 200 `{ success, message, data: { totalChannels,
  newChannels, updatedChannels, failedSources, sourcesProcessed } }`
- `GET  /api/channels` -> 200 `{ channels, pagination, categories, languages }`
  (extended — backward compatible: `data.channels` still works)
- `GET  /api/channels/[id]` -> 200 `{ channel: { ..., streamUrl } }` | 404
  (extended — now includes streamUrl)
- `GET  /api/channels/categories` -> 200 `{ categories, languages }` (NEW)
- `GET  /api/preferences` -> 200 `{ data: PreferencesData | null }` (NEW)

## Key decisions

- **Self-contained parser**: the M3U format is trivial enough (~120 lines)
  that importing `@iptv/playlist` is unnecessary. The parser handles \r\n /
  \n / \r line endings, parses `key="value"` attrs with a global regex,
  splits metadata from display name on the FIRST comma (so channel names
  containing commas survive), and tolerates orphan URL lines / unknown
  directives (`#EXTGRP`, `#EXTVLCOPT`, etc.) by ignoring them.
- **Deterministic channel ids**: `generateChannelId(url, name)` =
  `iptv-<slug>-<sha1-8>`. This means re-syncing the same playlist upserts
  rather than duplicates, and seeded channels (which use their own id
  scheme like `bbc-news`) are never accidentally overwritten by a sync.
- **Sync never 500s**: a sandbox without outbound internet to
  githubusercontent.com must NOT blow up the API. Each source is wrapped in
  its own try/catch; failures are recorded in `failedSources` and the route
  returns 200 with `sourcesProcessed` so the UI can show "sync attempted, X
  sources failed (likely offline)".
- **Per-source cap of 500**: prevents a single 50k-entry playlist from
  blowing past the `maxDuration = 300` budget. Logged as a warning when
  exceeded.
- **streamUrl split**: the LIST endpoint omits streamUrl (security smell to
  leak all stream URLs); the DETAIL endpoint includes it (the user has
  explicitly picked a channel to watch, the player needs the URL). This
  matches the task spec exactly.
- **Shared distinct helpers**: `getDistinctCategories` / `getDistinctLanguages`
  live in `src/lib/channels.ts` so `/api/channels` and
  `/api/channels/categories` can't drift apart. They use
  `where: { field: { not: null } }` + `distinct: ['field']` + `select` +
  orderBy asc, then filter nulls in JS (defensive against Prisma returning
  empty strings, etc.).
- **JSON array decoding**: `parseJsonArray(value)` uses `unknown` +
  `Array.isArray` + `typeof === 'string'` per-element filter. No `any`
  anywhere. Returns `[]` on parse failure / wrong shape / null so the
  frontend never sees a thrown error.
- **Backward compat**: the extended `/api/channels` response keeps
  `channels` as the first key with the same `ChannelPublic` shape. The new
  `pagination` / `categories` / `languages` keys are purely additive — the
  existing HomeView/GuideView/FavoritesView/ProfileView continue to work
  without changes (verified live in dev.log: `GET /api/channels?limit=100`
  and `GET /api/channels?q=ku&limit=100` both still return 200).

## Verification

- `bun run lint` — passes cleanly (0 errors, 0 warnings; output is literally
  `$ eslint .` with no diagnostics).
- `bunx tsc --noEmit` — zero errors in `src/` (only pre-existing error in
  `skills/stock-analysis-skill/src/analyzer.ts` which is not part of this
  task).
- `dev.log` — dev server still healthy; the extended `/api/channels`
  endpoint is already being exercised by the existing frontend
  (`GET /api/channels?limit=100 200 in 78ms` and
  `GET /api/channels?q=ku&limit=100 200 in 13ms`), proving the additive
  response shape didn't break anything. The Prisma query log confirms the
  page query + count + distinct categories + distinct languages are all
  running in parallel via `Promise.all`.
- No new packages installed (per task constraint). `hls.js` and
  `use-debounce` are already present for the Phase 2 frontend; nothing
  server-side needed them.
- No tests written (per task constraint).
- Prisma schema NOT modified (per task constraint — already had everything
  needed).
