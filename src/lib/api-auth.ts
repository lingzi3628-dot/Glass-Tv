/**
 * Shared auth helpers for GlassTV API routes.
 *
 * Every protected route uses `requireUser()` + `unauthorized()` to keep the
 * cookie-session check in one place.
 */
import { NextResponse } from 'next/server'

import { getSession, type SessionPayload } from '@/lib/session'

/** Returns the session payload if authenticated, otherwise null. */
export async function requireUser(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session) return null
  return session
}

/** Standard 401 response for unauthenticated requests. */
export function unauthorized() {
  return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
}

/** Standard 400 response for malformed/missing input. */
export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}
