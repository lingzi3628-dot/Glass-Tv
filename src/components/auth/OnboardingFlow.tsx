'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Heart, Sparkles, Tv, Check } from 'lucide-react'

import { GlassCard } from '@/components/glass/glass-card'
import { GlassButton } from '@/components/glass/glass-button'
import { GradientButton } from '@/components/glass/gradient-button'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store/app-store'
import { useAuthStore } from '@/lib/store/auth-store'
import { useOnboardingStore } from '@/lib/store/onboarding-store'

type Step = 'welcome' | 'genres' | 'languages' | 'habits' | 'recommendations' | 'complete'

interface GenreOption {
  value: string
  emoji: string
  label: string
}

interface LanguageOption {
  value: string
  label: string
}

interface HabitOption {
  value: string
  emoji: string
  label: string
}

const GENRES: GenreOption[] = [
  { value: 'sports', emoji: '⚽', label: 'Sports' },
  { value: 'news', emoji: '📰', label: 'News' },
  { value: 'movies', emoji: '🎬', label: 'Movies' },
  { value: 'documentaries', emoji: '🌍', label: 'Documentaries' },
  { value: 'kids', emoji: '🧸', label: 'Kids' },
  { value: 'music', emoji: '🎵', label: 'Music' },
  { value: 'lifestyle', emoji: '✨', label: 'Lifestyle' },
  { value: 'international', emoji: '🌐', label: 'International' },
]

const LANGUAGES: LanguageOption[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'pt', label: 'Portuguese' },
]

const VIEWING_TIMES: HabitOption[] = [
  { value: 'morning', emoji: '🌅', label: 'Morning' },
  { value: 'afternoon', emoji: '☀️', label: 'Afternoon' },
  { value: 'evening', emoji: '🌆', label: 'Evening' },
  { value: 'late_night', emoji: '🌙', label: 'Late Night' },
]

const VIEWING_DEVICES: HabitOption[] = [
  { value: 'phone', emoji: '📱', label: 'Phone' },
  { value: 'tablet', emoji: '📱', label: 'Tablet' },
  { value: 'tv', emoji: '🖥️', label: 'TV' },
  { value: 'computer', emoji: '💻', label: 'Computer' },
]

interface RecChannel {
  id: string
  name: string
  logoUrl?: string | null
  category?: string | null
  country?: string | null
  language?: string | null
}

const STEP_ORDER: Step[] = ['welcome', 'genres', 'languages', 'habits', 'recommendations']

const STEP_PROGRESS: Record<Step, number> = {
  welcome: 10,
  genres: 30,
  languages: 50,
  habits: 70,
  recommendations: 90,
  complete: 100,
}

const STEP_NUMBER: Record<Step, number> = {
  welcome: 1,
  genres: 2,
  languages: 3,
  habits: 4,
  recommendations: 5,
  complete: 5,
}

function parseEmojiFromLogo(logoUrl?: string | null): string | null {
  if (!logoUrl) return null
  if (logoUrl.startsWith('emoji:')) {
    return logoUrl.slice('emoji:'.length)
  }
  return null
}

export function OnboardingFlow() {
  const app = useAppStore()
  const auth = useAuthStore()
  const onboarding = useOnboardingStore()

  const [step, setStep] = React.useState<Step>('welcome')
  const [loadingRecs, setLoadingRecs] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [reasons, setReasons] = React.useState<Record<string, string>>({})
  const [recChannels, setRecChannels] = React.useState<RecChannel[]>([])
  const [favs, setFavs] = React.useState<Record<string, boolean>>({})

  const goNext = React.useCallback((to: Step) => setStep(to), [])
  const goBack = React.useCallback((to: Step) => setStep(to), [])

  async function handleGetRecommendations() {
    setLoadingRecs(true)
    try {
      const res = await fetch('/api/onboarding/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres: onboarding.selectedGenres,
          languages: onboarding.selectedLanguages,
          viewingTime: onboarding.viewingTime,
          viewingDevice: onboarding.viewingDevice,
        }),
      })
      if (!res.ok) throw new Error('failed')
      const data = (await res.json()) as {
        channelIds?: string[]
        reasons?: Record<string, string>
      }
      const channelIds = data.channelIds ?? []
      onboarding.setRecommendations(channelIds)
      setReasons(data.reasons ?? {})

      if (channelIds.length === 0) {
        setRecChannels([])
        setStep('complete')
        return
      }

      // Fetch the full channel objects for these ids.
      const channelsRes = await fetch('/api/channels?limit=200')
      const channelsData = (await channelsRes.json()) as {
        channels?: RecChannel[]
      }
      const map = new Map((channelsData.channels ?? []).map((c) => [c.id, c] as const))
      const resolved = channelIds
        .map((id) => map.get(id))
        .filter((c): c is RecChannel => Boolean(c))
      setRecChannels(resolved)
      setStep('recommendations')
    } catch {
      // Fallback: still let the user finish onboarding.
      setRecChannels([])
      setStep('complete')
    } finally {
      setLoadingRecs(false)
    }
  }

  async function handleComplete() {
    setSaving(true)
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          genres: onboarding.selectedGenres,
          languages: onboarding.selectedLanguages,
          viewingTime: onboarding.viewingTime,
          viewingDevice: onboarding.viewingDevice,
        }),
      })
      const currentUser = auth.user
      if (currentUser) {
        auth.setUser({ ...currentUser, onboardingCompleted: true })
      }
      onboarding.reset()
      app.goToApp('home')
    } finally {
      setSaving(false)
    }
  }

  function handleSkip() {
    onboarding.reset()
    app.goToApp('home')
  }

  async function toggleFavorite(channelId: string) {
    const isFav = !!favs[channelId]
    setFavs((prev) => ({ ...prev, [channelId]: !isFav }))
    try {
      if (isFav) {
        await fetch(`/api/favorites/${channelId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId }),
        })
      }
    } catch {
      // Revert on failure so the UI stays honest.
      setFavs((prev) => ({ ...prev, [channelId]: isFav }))
    }
  }

  const progress = STEP_PROGRESS[step]
  const stepNum = STEP_NUMBER[step]

  return (
    <div className="flex min-h-screen items-center justify-center p-4 py-10">
      <GlassCard
        variant="solid"
        hoverable={false}
        className="w-full max-w-2xl p-6 sm:p-8 animate-slide-up"
      >
        {/* Header / progress */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Step {stepNum} of 5
            </p>
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-ring rounded"
            >
              Skip
            </button>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {step === 'welcome' && (
              <WelcomeStep onNext={() => goNext('genres')} />
            )}

            {step === 'genres' && (
              <GenresStep
                selected={onboarding.selectedGenres}
                onToggle={onboarding.toggleGenre}
                onBack={() => goBack('welcome')}
                onNext={() => goNext('languages')}
              />
            )}

            {step === 'languages' && (
              <LanguagesStep
                selected={onboarding.selectedLanguages}
                onToggle={onboarding.toggleLanguage}
                onBack={() => goBack('genres')}
                onNext={() => goNext('habits')}
              />
            )}

            {step === 'habits' && (
              <HabitsStep
                viewingTime={onboarding.viewingTime}
                viewingDevice={onboarding.viewingDevice}
                onViewingTime={onboarding.setViewingTime}
                onViewingDevice={onboarding.setViewingDevice}
                onBack={() => goBack('languages')}
                onSubmit={handleGetRecommendations}
                loading={loadingRecs}
              />
            )}

            {step === 'recommendations' && (
              <RecommendationsStep
                channels={recChannels}
                reasons={reasons}
                favs={favs}
                onToggleFavorite={toggleFavorite}
                loading={loadingRecs}
                saving={saving}
                onBack={() => goBack('habits')}
                onComplete={handleComplete}
              />
            )}

            {step === 'complete' && (
              <CompleteStep
                saving={saving}
                onBack={() => goBack('habits')}
                onComplete={handleComplete}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </GlassCard>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Step components                                                            */
/* -------------------------------------------------------------------------- */

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
          <Tv className="h-10 w-10 text-primary-foreground" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Welcome to GlassTV! 👋
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto">
            Let&apos;s personalize your TV experience in just a few steps.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniCard emoji="🎯" title="Your interests" />
        <MiniCard emoji="🌍" title="Your languages" />
        <MiniCard emoji="✨" title="AI recommendations" />
      </div>

      <GradientButton size="lg" className="w-full" onClick={onNext}>
        Get Started
      </GradientButton>
    </div>
  )
}

function MiniCard({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="card-solid rounded-2xl p-4 flex flex-col items-center gap-2 text-center">
      <span className="text-3xl" role="img" aria-hidden>
        {emoji}
      </span>
      <span className="text-sm font-medium text-foreground">{title}</span>
    </div>
  )
}

function GenresStep({
  selected,
  onToggle,
  onBack,
  onNext,
}: {
  selected: string[]
  onToggle: (g: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const count = selected.length
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          What do you love watching?
        </h2>
        <p className="text-sm text-muted-foreground">
          Select 3-5 genres that interest you
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {GENRES.map((g) => {
          const isSelected = selected.includes(g.value)
          return (
            <button
              key={g.value}
              type="button"
              onClick={() => onToggle(g.value)}
              aria-pressed={isSelected}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-3 focus-ring',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/40',
              )}
            >
              <span className="text-2xl" role="img" aria-hidden>
                {g.emoji}
              </span>
              <span className="text-sm font-medium">{g.label}</span>
              {isSelected ? (
                <Check className="h-4 w-4 ml-auto" aria-hidden />
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <GlassButton variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
          Back
        </GlassButton>
        <GradientButton onClick={onNext} disabled={count < 3}>
          Next ({count}/3)
        </GradientButton>
      </div>
    </div>
  )
}

function LanguagesStep({
  selected,
  onToggle,
  onBack,
  onNext,
}: {
  selected: string[]
  onToggle: (l: string) => void
  onBack: () => void
  onNext: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          What languages do you speak?
        </h2>
        <p className="text-sm text-muted-foreground">Select all that apply</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {LANGUAGES.map((l) => {
          const isSelected = selected.includes(l.value)
          return (
            <button
              key={l.value}
              type="button"
              onClick={() => onToggle(l.value)}
              aria-pressed={isSelected}
              className={cn(
                'p-4 rounded-2xl border-2 transition-all duration-200 text-center flex items-center justify-center gap-2 focus-ring',
                isSelected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/40',
              )}
            >
              <span className="text-sm font-medium">{l.label}</span>
              {isSelected ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <GlassButton variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
          Back
        </GlassButton>
        <GradientButton onClick={onNext} disabled={selected.length < 1}>
          Next
        </GradientButton>
      </div>
    </div>
  )
}

function HabitsStep({
  viewingTime,
  viewingDevice,
  onViewingTime,
  onViewingDevice,
  onBack,
  onSubmit,
  loading,
}: {
  viewingTime: string | null
  viewingDevice: string | null
  onViewingTime: (t: string) => void
  onViewingDevice: (d: string) => void
  onBack: () => void
  onSubmit: () => void
  loading: boolean
}) {
  const canSubmit = Boolean(viewingTime) && Boolean(viewingDevice)

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          Your viewing habits
        </h2>
        <p className="text-sm text-muted-foreground">
          Help us understand your routine
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            When do you usually watch?
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {VIEWING_TIMES.map((t) => {
              const isSelected = viewingTime === t.value
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => onViewingTime(t.value)}
                  aria-pressed={isSelected}
                  className={cn(
                    'p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-3 focus-ring',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <span className="text-2xl" role="img" aria-hidden>
                    {t.emoji}
                  </span>
                  <span className="text-sm font-medium">{t.label}</span>
                  {isSelected ? (
                    <Check className="h-4 w-4 ml-auto" aria-hidden />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            What device do you use most?
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {VIEWING_DEVICES.map((d) => {
              const isSelected = viewingDevice === d.value
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => onViewingDevice(d.value)}
                  aria-pressed={isSelected}
                  className={cn(
                    'p-4 rounded-2xl border-2 transition-all duration-200 text-left flex items-center gap-3 focus-ring',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card hover:border-primary/40',
                  )}
                >
                  <span className="text-2xl" role="img" aria-hidden>
                    {d.emoji}
                  </span>
                  <span className="text-sm font-medium">{d.label}</span>
                  {isSelected ? (
                    <Check className="h-4 w-4 ml-auto" aria-hidden />
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <GlassButton variant="secondary" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
          Back
        </GlassButton>
        <GradientButton onClick={onSubmit} disabled={!canSubmit || loading}>
          {loading ? 'Thinking...' : 'Get Recommendations ✨'}
        </GradientButton>
      </div>
    </div>
  )
}

function RecommendationsStep({
  channels,
  reasons,
  favs,
  onToggleFavorite,
  loading,
  saving,
  onBack,
  onComplete,
}: {
  channels: RecChannel[]
  reasons: Record<string, string>
  favs: Record<string, boolean>
  onToggleFavorite: (id: string) => void
  loading: boolean
  saving: boolean
  onBack: () => void
  onComplete: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          We think you&apos;ll love these ✨
        </h2>
        <p className="text-sm text-muted-foreground">
          AI-selected channels based on your preferences
        </p>
      </div>

      {loading ? (
        <ul className="space-y-2" aria-label="Loading recommendations">
          {[0, 1, 2, 3].map((i) => (
            <li
              key={i}
              className="card-solid rounded-2xl p-4 flex items-center gap-3 animate-pulse"
            >
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="h-10 w-10 rounded-xl bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
              <div className="h-6 w-6 bg-muted rounded" />
            </li>
          ))}
        </ul>
      ) : channels.length === 0 ? (
        <div className="card-solid rounded-2xl p-6 text-center text-sm text-muted-foreground">
          No recommendations right now — you can finish onboarding and explore
          the catalog yourself.
        </div>
      ) : (
        <ul
          className={cn(
            'space-y-2',
            channels.length > 6 ? 'max-h-96 overflow-y-auto scrollbar-premium pr-1' : '',
          )}
        >
          {channels.map((c, idx) => {
            const emoji = parseEmojiFromLogo(c.logoUrl) ?? '📺'
            const reason = reasons[c.id]
            const isFav = !!favs[c.id]
            return (
              <li
                key={c.id}
                className="card-solid rounded-2xl p-3 sm:p-4 flex items-center gap-3"
              >
                <div
                  className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground text-sm font-bold flex items-center justify-center shrink-0"
                  aria-hidden
                >
                  {idx + 1}
                </div>
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <span className="text-2xl" role="img" aria-label={c.name}>
                    {emoji}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {c.name}
                    </p>
                    {c.category ? (
                      <span className="text-xs text-muted-foreground">
                        · {c.category}
                      </span>
                    ) : null}
                  </div>
                  {reason ? (
                    <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-2">
                      {reason}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={
                    isFav
                      ? `Remove ${c.name} from favorites`
                      : `Add ${c.name} to favorites`
                  }
                  aria-pressed={isFav}
                  onClick={() => onToggleFavorite(c.id)}
                  className="p-2 rounded-full hover:bg-muted transition-colors focus-ring shrink-0"
                >
                  <Heart
                    className={cn(
                      'h-5 w-5',
                      isFav
                        ? 'fill-red-500 text-red-500'
                        : 'text-foreground/60',
                    )}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <GlassButton variant="secondary" onClick={onBack} disabled={loading}>
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
          Back
        </GlassButton>
        <GradientButton onClick={onComplete} disabled={loading || saving}>
          {saving ? 'Saving...' : "Let's Go! 🚀"}
        </GradientButton>
      </div>
    </div>
  )
}

function CompleteStep({
  saving,
  onBack,
  onComplete,
}: {
  saving: boolean
  onBack: () => void
  onComplete: () => void
}) {
  return (
    <div className="space-y-6 text-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
          <Sparkles className="h-10 w-10 text-primary-foreground" aria-hidden />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground">
            Ready to dive in?
          </h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            We couldn&apos;t fetch personalized recommendations right now, but
            you can explore the full catalog and pick your favorites.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <GlassButton variant="secondary" onClick={onBack} disabled={saving}>
          <ArrowLeft className="h-4 w-4 mr-1.5" aria-hidden />
          Back
        </GlassButton>
        <GradientButton onClick={onComplete} disabled={saving}>
          {saving ? 'Saving...' : "Let's Go! 🚀"}
        </GradientButton>
      </div>
    </div>
  )
}
