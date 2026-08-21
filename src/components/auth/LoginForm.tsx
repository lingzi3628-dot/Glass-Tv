'use client'

import * as React from 'react'
import { Tv } from 'lucide-react'

import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GradientButton } from '@/components/glass/gradient-button'
import { useAppStore } from '@/lib/store/app-store'
import { useAuthStore } from '@/lib/store/auth-store'
import type { AuthUser } from '@/lib/store/auth-store'

interface LoginResponse {
  user?: AuthUser
  error?: string
}

export function LoginForm() {
  const setUser = useAuthStore((s) => s.setUser)
  const setStatus = useAuthStore((s) => s.setStatus)
  const goToApp = useAppStore((s) => s.goToApp)
  const setView = useAppStore((s) => s.setView)

  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as LoginResponse
      if (!res.ok || !data.user) {
        setError(data.error || 'Login failed')
        return
      }
      setUser(data.user)
      setStatus('authenticated')
      // Route based on onboarding status: new users -> onboarding, returning -> app.
      if (data.user.onboardingCompleted) {
        goToApp('home')
      } else {
        setView('onboarding')
      }
    } catch {
      setError('Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <GlassCard
        variant="premium"
        hoverable={false}
        className="w-full max-w-md p-8 space-y-6 animate-slide-up"
      >
        <header className="flex flex-col items-center text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
            <Tv className="h-6 w-6 text-primary-foreground" aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Welcome to GlassTV</h1>
            <p className="text-sm text-muted-foreground">Sign in to start watching</p>
          </div>
        </header>

        {error ? (
          <div
            role="alert"
            className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <GlassInput
            label="Email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <GlassInput
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <GradientButton
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </GradientButton>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={() => setView('signup')}
            className="font-semibold text-primary hover:underline focus-ring rounded"
          >
            Sign up
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
