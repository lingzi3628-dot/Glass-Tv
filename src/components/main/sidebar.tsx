'use client'

import * as React from 'react'
import { Compass, Heart, Home, Tv, User } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore, type AppTab } from '@/lib/store/app-store'
import { useAuthStore } from '@/lib/store/auth-store'

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

function getInitials(name: string | null | undefined, email: string): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    }
    return name.trim().slice(0, 2).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function Sidebar() {
  const activeTab = useAppStore((s) => s.activeTab)
  const setActiveTab = useAppStore((s) => s.setActiveTab)
  const user = useAuthStore((s) => s.user)

  const displayName = user?.displayName || 'TV Lover'
  const email = user?.email || ''
  const avatarUrl = user?.avatar ?? null

  return (
    <aside
      className={cn(
        'hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:z-40',
        'bg-sidebar border-r border-sidebar-border',
      )}
    >
      {/* Logo row */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-md">
          <Tv className="h-5 w-5 text-primary-foreground" aria-hidden />
        </div>
        <span className="text-xl font-bold text-foreground tracking-tight">
          GlassTV
        </span>
      </div>

      {/* Nav */}
      <nav
        aria-label="Main"
        className="flex-1 flex flex-col overflow-y-auto px-3 py-4 space-y-1 scrollbar-premium"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = activeTab === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors w-full text-left',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/70 hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Profile shortcut */}
      <div className="border-t border-sidebar-border px-3 py-4">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className="focus-ring flex items-center gap-3 rounded-xl p-2 w-full hover:bg-muted transition-colors text-left"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-xs font-bold">
              {getInitials(user?.displayName, email)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">
              {displayName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
        </button>
      </div>
    </aside>
  )
}
