# Task 3-B — Phase 3 Player Frontend (work record)

Task ID: 3-B
Agent: full-stack-developer (Phase 3 player frontend)
Task: playerStore, useRemoteControl, full Player + PlayerControls + PlayerSettings

## Files produced (all NEW)

- `src/lib/store/player-store.ts`
  - Zustand store with `persist` middleware (name `'glasstv-player'`).
  - `partialize` persists ONLY `volume` and `playbackRate` (user prefs).
  - State slices: playback (isPlaying/isMuted/volume/currentTime/duration/
    buffering/playbackRate), quality (currentLevel/availableLevels), UI
    (controlsVisible/isFullscreen/isPiP/showSettings/showQualitySelector).
  - Setters for every field + toggles (togglePlay/Mute/Fullscreen/PiP/
    Settings/QualitySelector) + `seekTo(time)` + `reset()`.
  - `reset()` preserves `volume`/`playbackRate` so the user's preferences
    survive across open/close cycles within a session.

- `src/hooks/use-remote-control.ts`
  - Smart TV D-pad navigation hook.
  - Registers `keydown` on `document` for arrows / Enter / Esc / Backspace /
    Space / MediaPlay / MediaPause / MediaPlayPause / MediaStop / `f` / `m` /
    number keys 0-9 / VolumeUp / VolumeDown / VolumeMute / AudioVolumeMute.
  - Maintains a live `focusableElements` list via `querySelectorAll` on
    `focusContainer?.current ?? document` with the given `focusSelector`.
    A `MutationObserver` keeps the list fresh as the DOM changes.
  - Returns `{ focusableElements, currentFocusIndex, focusFirst, focusNext,
    focusPrevious, updateFocusableElements }`.
  - Spec extension: added `onTogglePlay` callback (Space / MediaPlayPause
    are toggle keys, but the spec only listed `onPlay`/`onPause`).
  - Accessibility polyfill: adds `using-keyboard` class to `<html>` on
    keydown, removes on mousedown. Injects a `<style>` tag with
    `.using-keyboard .focus-ring:focus { box-shadow: ... }` so programmatic
    focus (via `focusNext`) shows a focus ring (the default `:focus-visible`
    selector doesn't match programmatic focus).
  - Lint note: had to use a ref-stored-function pattern for
    `updateFocusableElements` to satisfy the React Compiler's
    `react-hooks/preserve-manual-memoization` rule (it flags accessing
    `ref.current` inside a `useCallback`). The exposed callback is stable
    (empty deps) and always calls the latest impl via `updateFnRef.current`.

- `src/components/player/player-settings.tsx`
  - Centered modal overlay (click backdrop to close) using `glass-dark`.
  - Three sections: Quality (Auto + each available level with kbps),
    Playback speed (3-col grid of [0.5, 0.75, 1, 1.25, 1.5, 2]),
    Volume (mute button + range slider + percentage).
  - Returns null when `!visible` so AnimatePresence can mount/unmount it.
  - lucide icons: Gauge, Clock, Volume2, VolumeX, X.

- `src/components/player/player-controls.tsx`
  - Bottom control bar (`from-black/90 via-black/40 to-transparent` gradient).
  - Returns null when `!visible` (whole bar hides during auto-hide).
  - Seek bar: pointer-events based (pointerdown -> setPointerCapture ->
    pointermove seeks -> pointerup releases). Gradient fill (from-primary
    to-secondary) + thumb on hover. For LIVE streams (duration = Infinity,
    <= 0, or > 24h), hides the seek bar and shows a red "Live" badge with
    ping animation instead.
  - Left cluster: Play/Pause, Mute, Volume slider (hidden on mobile), time
    display `M:SS / M:SS` (or `LIVE` for live streams), "Buffering…" label.
  - Right cluster: Playback rate button (cycles 0.5->0.75->1->1.25->1.5->2),
    Quality selector button + dropdown (glass-dark, lists Auto + each level
    with kbps; active item highlighted with `bg-primary/30 text-primary`;
    closes on outside-click via a deferred mousedown listener),
    PiP button (always rendered; Player guards the actual call), Fullscreen
    button, Settings gear.
  - All buttons: `min-h-[44px] min-w-[44px]` (touch-friendly), `focus-ring`,
    `player-focusable` class, proper `aria-label`/`aria-pressed`/`aria-expanded`.
  - lucide icons: Play, Pause, Volume2, VolumeX, ChevronUp, Maximize2,
    Minimize2, PictureInPicture, Settings.

- `src/components/player/player.tsx`
  - The full Player component. Replaces the Phase 2 `PlayerOverlay` (which
    is intentionally NOT modified — the orchestrator will swap the import).
  - Props: `{ channel: Channel; onBack?: () => void }`.
  - Uses `usePlayerStore` for ALL state. Subscribes to individual slices
    to minimize re-renders.
  - Sets up hls.js DIRECTLY (not via the old `useHlsPlayer` hook — needs
    fine-grained control over quality levels + buffering events).
    - Config: `enableWorker, lowLatencyMode, maxBufferLength: 30,
      startLevel: currentLevel`.
    - MANIFEST_PARSED: setLoading(false), populate availableLevels from
      `hls.levels` (mapped to QualityLevel with `levelLabel(height)` ->
      "4K"/"1080p"/"720p"/.../"240p"), autoplay with promise rejection
      handling (autoplay blocked -> setPlaying(false), no crash).
    - LEVEL_SWITCHED: setCurrentLevel(data.level).
    - ERROR (fatal): setError + destroy hls instance.
    - FRAG_LOADING/FRAG_LOADED: setBuffering(true/false).
    - Safari fallback: native HLS via `video.src` + `loadedmetadata`.
    - "Neither supported" path: sets an error.
  - Video event listeners (play/pause/timeupdate/durationchange/volumechange/
    waiting/playing/canplay) sync to the store.
  - Effects apply store values to the video: isPlaying -> play()/pause()
    (with autoplay rejection -> setPlaying(false) revert), volume ->
    video.volume, isMuted -> video.muted, playbackRate -> video.playbackRate.
  - Quality change effect: `hls.currentLevel = currentLevel` (separate from
    the hls setup effect so toggling quality doesn't recreate the Hls
    instance).
  - Fullscreen: `containerRef.current.requestFullscreen()` /
    `document.exitFullscreen()`. `fullscreenchange` listener syncs
    `isFullscreen` to the store.
  - PiP: `video.requestPictureInPicture()` /
    `document.exitPictureInPicture()`. Guards with
    `document.pictureInPictureEnabled` and
    `typeof video.requestPictureInPicture === 'function'`.
    `enterpictureinpicture`/`leavepictureinpicture` listeners sync `isPiP`.
  - Watch history: POST `/api/history` with `{ channelId, durationSeconds }`
    every 30s while playing (interval), AND on unmount if `currentTime > 5`
    (uses `navigator.sendBeacon` with a JSON Blob so it fires even if the
    page is closing; falls back to `fetch(..., { keepalive: true })`).
  - Auto-hide controls: 5s timer when `isPlaying && controlsVisible &&
    !showSettings`. `resetCounter` lets `showControls()` restart the timer
    on mousemove/click/any-key. A separate generic keydown listener calls
    `showControls()` on any key.
  - Remote control: `useRemoteControl` wired with onEnter (togglePlay if no
    button focused, else click focused element), onBack (close settings ->
    close quality dropdown -> onBack prop), onArrowUp/Down (volume ±0.1),
    onArrowLeft/Right (seek ∓10s), onTogglePlay/onPlay/onPause, onMute,
    onFullscreen, onNumber (seek to N% of duration). `focusSelector` is
    `.player-focusable`, `focusContainer` is the player container.
  - Layout: `motion.div` (fixed inset-0 z-50 bg-black) with framer-motion
    initial/animate/exit opacity. Children:
    - `<video>` (w-full h-full object-contain, onClick toggles play with
      stopPropagation so the container's onClick doesn't double-fire).
    - Loading spinner (Loader2).
    - Error state (AlertCircle + Retry button + Go back button).
    - Buffering spinner overlay (pointer-events-none).
    - Top bar (only when controlsVisible && !error): back arrow, channel
      logo (emoji:/http/📺 fallback), channel name, LIVE badge with pulse,
      category, favorites heart (wired to useFavorites), close X.
    - Center play button (when paused && controlsVisible && !loading &&
      !error).
    - `<PlayerControls ... />` (when !error).
    - `<PlayerSettings ... />` (always rendered; returns null when !visible
      so AnimatePresence can mount/unmount).

## Skipped
- `src/components/player/keyboard-shortcuts.tsx` — the spec said this is
  optional if `useRemoteControl` covers the shortcuts. It does: Space/K
  (onTogglePlay), F (onFullscreen), M (onMute), ArrowUp/Down (volume ±0.1),
  ArrowLeft/Right (seek ∓10s), media keys, number keys. No separate
  keyboard-shortcuts component needed.

## Lint / type check
- `bun run lint` — PASS (0 errors, 0 warnings) after fixing two issues:
  1. `react-hooks/refs` — was assigning `optionsRef.current = options`
     during render. Fixed by moving to `useEffect(() => { optionsRef.current = options })`.
  2. `react-hooks/preserve-manual-memoization` — was accessing
     `focusContainer?.current` inside a `useCallback`. Fixed by using a
     ref-stored-function pattern (`updateFnRef`).
- `bunx tsc --noEmit` — 0 errors in src/. (Only pre-existing errors in
  examples/websocket, skills/image-edit, skills/stock-analysis-skill —
  none in src/.)
- Dev server log confirms the new files compile cleanly
  (`✓ Compiled in 310ms` / `375ms` / `393ms`) with no warnings.

## Integration notes for the orchestrator
- Import: `import { Player } from '@/components/player/player'`.
- Render: `<Player channel={playerChannel} onBack={closePlayer} />`.
- The orchestrator's `PlayerOverlayHost` currently renders the Phase 2
  `<PlayerOverlay />` (which reads `playerChannel` from the store itself).
  To switch to the new Player, change the host to:
  ```tsx
  function PlayerOverlayHost() {
    const playerChannel = useAppStore((s) => s.playerChannel)
    const closePlayer = useAppStore((s) => s.closePlayer)
    return (
      <AnimatePresence>
        {playerChannel ? (
          <Player channel={playerChannel} onBack={closePlayer} />
        ) : null}
      </AnimatePresence>
    )
  }
  ```
- The old `PlayerOverlay` and `useHlsPlayer` are NOT modified — they're
  still imported by `page.tsx` and `preview-popup.tsx` respectively. The
  orchestrator can leave them in place or remove the PlayerOverlay import
  once the swap is done.
- The Player depends on `/api/history` (POST) and `/api/channels/[id]`
  (GET, to fetch streamUrl if the channel doesn't carry one). Both routes
  already exist and require auth.
- `useFavorites()` is called inside the Player — it fetches
  `/api/favorites` on mount. If the user already has favorites loaded
  elsewhere, this is a redundant fetch, but it keeps the Player
  self-contained. The hook is the same one used by all four tab views.
