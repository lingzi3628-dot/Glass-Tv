'use client'

import { motion } from 'framer-motion'
import { Tv, Sparkles, Globe, Languages, Clock, Monitor, Heart, ArrowRight, Zap } from 'lucide-react'
import { useAppStore } from '@/lib/store/app-store'
import { GradientButton, GlassButton } from '@/components/glass'
import { GlassCard } from '@/components/glass'

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI-Powered Recommendations',
    desc: 'Our onboarding AI learns your taste and curates channels you\'ll actually love.',
    color: 'from-violet-500/20 to-purple-500/10',
  },
  {
    icon: Globe,
    title: 'Channels From Everywhere',
    desc: 'Sports, news, movies, documentaries, music and international content in 7 languages.',
    color: 'from-amber-500/20 to-orange-500/10',
  },
  {
    icon: Languages,
    title: 'Multilingual Subtitles',
    desc: 'Live AI captions in your preferred language, coming soon in Phase 2.',
    color: 'from-emerald-500/20 to-teal-500/10',
  },
  {
    icon: Monitor,
    title: 'Any Screen, Anywhere',
    desc: 'Phone, tablet, TV or computer — GlassTV adapts to how you watch.',
    color: 'from-rose-500/20 to-pink-500/10',
  },
]

const GENRE_PILLS = [
  { label: '⚽ Sports', tint: 'bg-amber-500/10 text-amber-700' },
  { label: '📰 News', tint: 'bg-blue-500/10 text-blue-700' },
  { label: '🎬 Movies', tint: 'bg-purple-500/10 text-purple-700' },
  { label: '🌍 Docs', tint: 'bg-emerald-500/10 text-emerald-700' },
  { label: '🧸 Kids', tint: 'bg-rose-500/10 text-rose-700' },
  { label: '🎵 Music', tint: 'bg-pink-500/10 text-pink-700' },
  { label: '🌿 Lifestyle', tint: 'bg-green-500/10 text-green-700' },
  { label: '🌐 International', tint: 'bg-indigo-500/10 text-indigo-700' },
]

export function LandingPage() {
  const setView = useAppStore((s) => s.setView)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav */}
      <header className="sticky top-0 z-40 glass-premium border-b border-border/40">
        <div className="container mx-auto max-w-6xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/30">
              <Tv className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">GlassTV</span>
          </div>
          <div className="flex items-center gap-2">
            <GlassButton variant="ghost" size="sm" onClick={() => setView('login')}>
              Sign in
            </GlassButton>
            <GradientButton size="sm" onClick={() => setView('signup')}>
              Get started
            </GradientButton>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden flex-1 flex items-center">
        {/* Decorative gradient blobs */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-secondary/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
        </div>

        <div className="container mx-auto max-w-6xl px-4 py-16 sm:py-24 grid lg:grid-cols-2 gap-12 items-center">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6 text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium">
              <Zap className="w-3.5 h-3.5" />
              Phase 1 · Foundation Live
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.05]">
              Your window to{' '}
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                the world
              </span>{' '}
              of TV.
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto lg:mx-0">
              GlassTV is an AI-powered IPTV experience that learns what you love
              and brings it to every screen — phone, tablet, TV or computer.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <GradientButton size="lg" onClick={() => setView('signup')} className="group">
                Start watching free
                <ArrowRight className="w-4 h-4 ml-2 inline transition-transform group-hover:translate-x-1" />
              </GradientButton>
              <GlassButton variant="secondary" size="lg" onClick={() => setView('login')}>
                I have an account
              </GlassButton>
            </div>

            {/* Genre pills */}
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start pt-2">
              {GENRE_PILLS.map((p) => (
                <span
                  key={p.label}
                  className={`px-3 py-1 rounded-full text-xs font-medium ${p.tint}`}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Visual mockup */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative"
          >
            <GlassCard variant="premium" className="p-5 relative z-10" hoverable={false}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs text-muted-foreground font-mono">glasstv.app</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { e: '🏆', n: 'Sports', c: 'from-amber-500/20 to-orange-500/10' },
                  { e: '🎬', n: 'Movies', c: 'from-purple-500/20 to-pink-500/10' },
                  { e: '🌍', n: 'News', c: 'from-blue-500/20 to-cyan-500/10' },
                  { e: '🎵', n: 'Music', c: 'from-pink-500/20 to-rose-500/10' },
                  { e: '🦁', n: 'Nature', c: 'from-emerald-500/20 to-teal-500/10' },
                  { e: '🧸', n: 'Kids', c: 'from-rose-500/20 to-red-500/10' },
                ].map((t, i) => (
                  <motion.div
                    key={t.n}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.08 }}
                    className={`aspect-square rounded-2xl bg-gradient-to-br ${t.c} border border-border/60 flex flex-col items-center justify-center gap-1`}
                  >
                    <span className="text-3xl">{t.e}</span>
                    <span className="text-xs font-medium text-foreground/80">{t.n}</span>
                  </motion.div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">AI picked 8 channels for you</p>
                  <p className="text-[10px] text-muted-foreground">Based on your taste profile</p>
                </div>
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
              </div>
            </GlassCard>

            {/* Floating accent card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute -bottom-6 -right-4 sm:-right-6 z-20 hidden sm:block"
            >
              <GlassCard variant="solid" className="p-3 flex items-center gap-2 shadow-xl" hoverable={false}>
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground">Watch anytime</span>
              </GlassCard>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20 bg-card/50 border-y border-border/60">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-12 space-y-2">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Built for the way you actually watch
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every feature is designed around one question: what would make
              finding something great to watch effortless?
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
              >
                <GlassCard variant="solid" className="p-6 h-full">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4`}>
                    <f.icon className="w-6 h-6 text-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto max-w-3xl px-4 text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
            Ready to meet your next favorite channel?
          </h2>
          <p className="text-muted-foreground">
            Create a free account and let our AI find your perfect lineup in under a minute.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <GradientButton size="lg" onClick={() => setView('signup')} className="group">
              Create my lineup
              <ArrowRight className="w-4 h-4 ml-2 inline transition-transform group-hover:translate-x-1" />
            </GradientButton>
            <GlassButton variant="secondary" size="lg" onClick={() => setView('login')}>
              Sign in
            </GlassButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border py-6 px-4">
        <div className="container mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Tv className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-medium text-foreground">GlassTV</span>
            <span>· Phase 1</span>
          </div>
          <p className="text-xs">AI-Powered IPTV · Built with Next.js 16</p>
        </div>
      </footer>
    </div>
  )
}
