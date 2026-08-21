# Task 3-b — Main layout + views

**Agent**: full-stack-developer (main layout + views)
**Date**: phase 1 build
**Status**: complete, lint passes (0 errors / 0 warnings), tsc clean for src/

## Files produced (all NEW)

- `src/lib/types.ts` — shared `Channel` interface + `CHANNEL_CATEGORIES` / `CHANNEL_LANGUAGES` consts
- `src/lib/hooks/use-favorites.ts` — `useFavorites()` optimistic favorites hook (GET on mount, POST/DELETE on toggle, revert on failure)
- `src/components/main/channel-card-skeleton.tsx` — `ChannelCardSkeleton` + `ChannelCardGridSkeleton` matching ChannelCard footprint
- `src/components/main/sidebar.tsx` — desktop-only fixed left sidebar (logo, nav, profile shortcut)
- `src/components/main/bottom-nav.tsx` — mobile-only fixed bottom nav with gradient active bar + safe-area padding
- `src/components/main/header.tsx` — sticky top header (search + Bell + name + logout); exports `SEARCH_SESSION_KEY = 'glasstv-search'`
- `src/components/main/home-view.tsx` — hero greeting, Continue Watching (4 cards), Recommended (8 cards), All Channels horizontal scroller
- `src/components/main/guide-view.tsx` — full filterable grid (search input, category chips, language Select, debounced fetch, empty state)
- `src/components/main/favorites-view.tsx` — favorites list with friendly empty state
- `src/components/main/profile-view.tsx` — identity card, stats row (favorites + channel count), preferences card with re-run onboarding CTA, sign-out card
- `src/components/main/app-shell.tsx` — top-level layout combining Sidebar + BottomNav + Header + AnimatePresence view switch + sticky footer

## Key decisions

- **Single source of truth for favorites**: `useFavorites()` hook keeps a `Set<string>` in React state; Home/Guide/Favorites/Profile all read `isFavorite` and call `toggleFavorite`. Optimistic update + revert-on-failure keeps the heart UI snappy.
- **Search handoff**: Header writes the search query to `sessionStorage['glasstv-search']` and switches to `guide` tab; GuideView reads it on mount. Simple, no extra zustand slice needed.
- **Debounced guide search**: input field is controlled by immediate `search` state, but the fetch effect reacts to `debouncedSearch` (250ms lag) so we don't spam the API on every keystroke.
- **Sticky footer**: outer div `min-h-screen flex flex-col` + content column `flex-1 flex flex-col min-h-screen` + main `flex-1` + footer `mt-auto` — the footer sticks to viewport bottom on short content and is pushed down by long content.
- **Mobile safe area**: BottomNav uses `pb-[env(safe-area-inset-bottom)]` to respect iOS home indicator.
- **All interactive elements are `<button>`** (or proper form controls). Nav items in Sidebar/BottomNav are `<button>` not `<Link>` — this is a SPA driven by `useAppStore.setActiveTab`, no Next.js routing.
- **No `any`** — fetch responses are typed via small local interfaces (`ChannelsResponse`, `FavoritesResponse`), body fields validated with `typeof`.
- **No new packages installed.** Reused shadcn Select + Skeleton where it made sense.
- **Footer text**: `GlassTV · Phase 1 · AI-Powered IPTV` per spec.

## How to wire into page.tsx (next task)

`src/app/page.tsx` should read `useAuthStore` and `useAppStore`, and when `view === 'app'` render `<AppShell />`:

```tsx
import { useAppStore } from '@/lib/store/app-store'
import { useAuthStore } from '@/lib/store/auth-store'
import { AppShell } from '@/components/main/app-shell'

// inside the page component:
const view = useAppStore((s) => s.view)
if (view === 'app') return <AppShell />
```

## Verification

- `bun run lint` — passes cleanly (0 errors, 0 warnings)
- `bunx tsc --noEmit` — zero errors in `src/` (only pre-existing errors in `examples/` and `skills/` folders which are eslint-ignored)
- Dev server log shows healthy 200s on `/`
