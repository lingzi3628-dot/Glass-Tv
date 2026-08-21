'use client'

import * as React from 'react'
import { Tv } from 'lucide-react'

import { GlassCard } from '@/components/glass/glass-card'
import { GlassInput } from '@/components/glass/glass-input'
import { GradientButton } from '@/components/glass/gradient-button'
import { useAppStore } from '@/lib/store/app-store'
import { useAuthStore } from '@/lib/store/auth-store'
import type { AuthUser } from '@/lib/store/auth-store'

interface SignupResponse {
  user?: AuthUser
  error?: string
}

export function SignupForm() {
  const setUser = useAuthStore((s) => s.setUser)
  const setStatus = useAuthStore((s) => s.setStatus)
  const setView = useAppStore((s) => s.setView)

  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = (await res.json()) as SignupResponse
      if (!res.ok || !data.user) {
        setError(data.error || 'Sign up failed')
        return
      }
      setUser(data.user)
      setStatus('authenticated')
      // Don't route here - let the orchestrator decide based on
      // onboardingCompleted (new users go to onboarding, returning users to home).
      setView('onboarding')
    } catch {
      setError('Sign up failed')
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
            <h1 className="text-2xl font-bold text-foreground">Create Account</h1>
            <p className="text-sm text-muted-foreground">
              Start your personalized TV experience
            </p>
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
            label="Name"
            type="text"
            required
            autoComplete="name"
            placeholder="Your Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
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
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <GlassInput
            label="Confirm Password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <GradientButton
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </GradientButton>
        </form>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => setView('login')}
            className="font-semibold text-primary hover:underline focus-ring rounded"
          >
            Sign in
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
