# Task 4-B — Phase 4 captions backend

**Agent:** full-stack-developer (Phase 4 captions backend)
**Task:** `/api/captions` (ASR transcribe + cache) + `/api/caption-settings` + `/api/captions/[id]`

## Files produced (all NEW)

1. `src/app/api/captions/route.ts` — POST (transcribe + cache) + GET (cached range)
2. `src/app/api/caption-settings/route.ts` — GET (user prefs) + POST (upsert with validation)
3. `src/app/api/captions/[id]/route.ts` — DELETE (single cache entry)

## Endpoints exposed

All require auth via `requireUser` (401 on missing session). All return JSON.
All wrapped in try/catch with `console.error` tagged logs.

| Method | Path | Status | Body |
|--------|------|--------|------|
| POST   | `/api/captions` | 200 / 400 / 401 / 500 / 503 | `{ audio, channelId, timestamp, language? }` -> `{ text, cached, timestamp, empty? }` |
| GET    | `/api/captions?channelId=X&from=0&to=99999&language=en` | 200 / 400 / 401 / 500 | -> `{ data: CaptionRow[] }` |
| GET    | `/api/caption-settings` | 200 / 401 / 500 | -> `{ data: Settings \| null }` |
| POST   | `/api/caption-settings` | 200 / 400 / 401 / 500 | partial Settings -> `{ success: true, data: Settings }` |
| DELETE | `/api/captions/[id]` | 200 / 400 / 401 / 404 / 500 | -> `{ success: true }` |

## Key implementation notes

### ZAI SDK lazy singleton

```ts
let zaiPromise: Promise<ZAI> | null = null
function getZai(): Promise<ZAI> {
  if (!zaiPromise) zaiPromise = ZAI.create()
  return zaiPromise
}
```

`ZAI.create()` runs at most once per process; subsequent requests reuse the cached Promise.

### ASR response type narrowing

The SDK types `zai.audio.asr.create()` as returning `any`. To keep my own code
`any`-free, I narrowed it via an `AsrResponse` interface and a runtime check:

```ts
interface AsrResponse { text?: unknown }
const response = (await zai.audio.asr.create({ file_base64: audio })) as AsrResponse
const raw = typeof response?.text === 'string' ? response.text : ''
text = raw.trim()
```

### Three distinct POST failure modes

1. **SDK throws** (model loading / network) -> `503 { error: 'Caption service temporarily unavailable', loading: true, details }` — frontend can retry uniformly on `loading: true`.
2. **ASR returns empty text** -> `200 { text: '', cached: false, timestamp, empty: true }` and NOT cached (per spec).
3. **Anything else** -> `500 { error: 'Transcription failed', details }`.

### Cache race tolerance

`db.captionsCache.create()` is wrapped in try/catch; `Prisma.PrismaClientKnownRequestError`
with `code === 'P2002'` (concurrent race on the composite unique
`channelId+timestamp+language`) is swallowed — the text is still returned to
the caller. Matches the favorites POST idempotency pattern from task 2-b.

### CaptionSettings validation

`validateBody` enforces:
- `enabled` -> boolean
- `language` -> 2-letter lowercase code (`^[a-z]{2}$`)
- `fontSize` -> number 12-48 (Math.floor'd)
- `fontColor` / `backgroundColor` -> non-empty string (trimmed)
- `position` -> one of `bottom | middle | top` (Set lookup)

Partial updates work cleanly — only fields explicitly provided AND validated
are included in the upsert. The `upsert` create-branch spreads `...data`
alongside `userId`, so schema defaults (enabled=true, fontSize=18, etc.)
fill in any missing fields on first save.

## Verification

- `bun run lint` -> **PASS** (0 errors, 0 warnings)
- `bunx tsc --noEmit` -> **0 errors** in `src/` (only pre-existing errors in `examples/` and `skills/` folders which are eslint-ignored)
- Smoke tests via curl (no session cookie) -> all 3 routes return `401 { error: 'unauthenticated' }`:
  - `GET /api/caption-settings` -> 401
  - `GET /api/captions` -> 401
  - `DELETE /api/captions/1` -> 401
- dev.log confirms clean compilation: "✓ Compiled in 292ms" / "348ms" / "700ms"
- Prisma client regenerated (`bun run db:generate` + `bun run db:push`) so
  `db.captionsCache` and `db.captionSetting` are available at runtime —
  confirmed 509 references to `CaptionsCache` in the generated types.

## Integration notes for downstream agents

### Frontend captions hook (suggested shape)

```ts
// POST a chunk for transcription (with cache)
fetch('/api/captions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    audio: base64Wav,        // base64-encoded WAV audio chunk
    channelId: channel.id,
    timestamp: Math.floor(elapsedSeconds),
    language: 'en',          // optional, defaults to 'en'
  }),
})
// -> 200 { text, cached, timestamp, empty? }
// -> 503 { loading: true } -> RETRY with backoff
// -> 500 { error } -> show error UI

// GET cached captions for a time range
fetch(`/api/captions?channelId=${channelId}&from=0&to=99999&language=en`)
// -> 200 { data: CaptionRow[] }
```

### Frontend settings hook (suggested shape)

```ts
// Load current settings (may be null on first visit)
fetch('/api/caption-settings')
// -> 200 { data: Settings | null }

// Save partial update
fetch('/api/caption-settings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ enabled: true, fontSize: 24 }),  // any subset
})
// -> 200 { success: true, data: Settings }
```

### CaptionRow shape (from GET /api/captions)

```ts
interface CaptionRow {
  id: number
  channelId: string
  timestamp: number      // seconds into the stream
  text: string
  language: string       // 2-letter code
  createdAt: string      // ISO timestamp
}
```

### Settings shape (from GET/POST /api/caption-settings)

```ts
interface CaptionSettings {
  enabled: boolean
  language: string       // 2-letter code
  fontSize: number       // 12-48
  fontColor: string      // hex or color name
  backgroundColor: string // rgba/hex/color name
  position: 'bottom' | 'middle' | 'top'
}
```

## No new packages installed

Per task constraint. `z-ai-web-dev-sdk@0.0.18` was already in `package.json`.
No tests written (per task constraint). Prisma schema NOT modified (already
had `CaptionsCache` + `CaptionSetting` from the orchestrator).
