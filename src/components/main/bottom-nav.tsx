'use client'

import * as React from 'react'
import { Compass, Heart, Home, User } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore, type AppTab } from '@/lib/store/app-store'

interface NavItem {
  id: AppTab
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'guide', label: 'Guide', icon: Compass },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'profile', label: 'Profile', icon: User },
]

export function BottomNav() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'lg:hidden fixed bottom-0 left-0 right-0 z-40',
        'glass-premium border-t border-border/40',
        // Respect the iOS safe area at the bottom of the viewport.
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <div className="flex items-center justify-around h-16">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              className={cn(
                'focus-ring relative flex flex-col items-center justify-center gap-1 flex-1 h-full',
                'transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="absolute -top-0.5 w-8 h-0.5 bg-gradient-to-r from-primary to-secondary rounded-full"
                />
              ) : null}
              <Icon
                className={cn(
                  'h-5 w-5 transition-transform',
                  active ? 'scale-110' : '',
                )}
                aria-hidden
              />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
