'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { useAppStore } from '@/lib/store/app-store'
import { Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { Header } from './header'
import { HomeView } from './home-view'
import { GuideView } from './guide-view'
import { FavoritesView } from './favorites-view'
import { ProfileView } from './profile-view'

export function AppShell() {
  const activeTab = useAppStore((s) => s.activeTab)

  function renderView() {
    switch (activeTab) {
      case 'home':
        return <HomeView />
      case 'guide':
        return <GuideView />
      case 'favorites':
        return <FavoritesView />
      case 'profile':
        return <ProfileView />
      default:
        return <HomeView />
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Sidebar />
      <BottomNav />
      <div className="flex-1 lg:pl-64 pb-20 lg:pb-0 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-6xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer className="mt-auto border-t border-border py-4 px-4 text-center text-xs text-muted-foreground">
          GlassTV · Phase 1 · AI-Powered IPTV
        </footer>
      </div>
    </div>
  )
}
