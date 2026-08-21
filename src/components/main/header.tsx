'use client'

import * as React from 'react'
import { Bell, LogOut, Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { GlassButton } from '@/components/glass/glass-button'
import { useAppStore } from '@/lib/store/app-store'
import { useAuthStore } from '@/lib/store/auth-store'

/** sessionStorage key used to hand the search query from Header -> GuideView. */
export const SEARCH_SESSION_KEY = 'glasstv-search'

export function Header() {
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const setView = useAppStore((s) => s.setView)
  const logout = useAuthStore((s) => s.logout)
  const user = useAuthStore((s) => s.user)

  const [query, setQuery] = React.useState('')

  const displayName = user?.displayName || 'TV Lover'

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (typeof window !== 'undefined') {
      try {
        window.sessionStorage.setItem(SEARCH_SESSION_KEY, query)
      } catch {
        // sessionStorage can throw in private modes / SSR - ignore.
      }
    }
    setActiveTab('guide')
  }

  async function handleLogout() {
    await logout()
    setView('landing')
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30 glass-premium border-b border-border/40',
      )}
    >
      <div className="container mx-auto max-w-6xl px-4">
        <div className="flex items-center gap-3 h-16">
          {/* Search */}
          <form
            onSubmit={handleSubmit}
            role="search"
            className="relative flex-1 max-w-md"
          >
            <label htmlFor="glasstv-header-search" className="sr-only">
              Search channels
            </label>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              aria-hidden
            />
            <input
              id="glasstv-header-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels..."
              className={cn(
                'focus-ring bg-card/60 border border-border rounded-xl pl-10 pr-4 py-2 text-sm',
                'w-full placeholder:text-muted-foreground/70',
                'focus:border-transparent',
              )}
            />
          </form>

          <div className="flex items-center gap-2 ml-auto">
            {/* Bell - visual only for Phase 1 */}
            <GlassButton
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              className="text-foreground/70 hover:text-foreground"
            >
              <Bell className="h-5 w-5" aria-hidden />
            </GlassButton>

            <span
              className="hidden sm:block text-sm font-medium text-foreground truncate max-w-[160px]"
              title={displayName}
            >
              {displayName}
            </span>

            <GlassButton
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Sign out"
              className="text-foreground/70 hover:text-foreground"
            >
              <LogOut className="h-5 w-5" aria-hidden />
            </GlassButton>
          </div>
        </div>
      </div>
    </header>
  )
}
