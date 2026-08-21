/**
 * Lightweight cookie-based session for the GlassTV single-page app.
 *
 * Why not NextAuth here? The original spec calls for a redirect-free SPA flow
 * (login -> onboarding -> home, all on the `/` route). NextAuth v4's credentials
 * provider is built around full-page redirects, which fights that model.
 * A signed HMAC cookie gives us exactly the UX we need with no extra deps.
 *
 * Passwords are hashed with Node's built-in scryptSync (no bcryptjs dep).
 */
import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual, randomBytes, scryptSync, randomUUID } from 'crypto'

const COOKIE_NAME = 'glasstv_session'
const SESSION_TTL = 60 * 60 * 24 * 7 // 7 days

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.SECRET
  if (!secret) {
    // Dev-only fallback so the app still boots without env config.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing NEXTAUTH_SECRET env var')
    }
    return 'glasstv-dev-secret-do-not-use-in-prod'
  }
  return secret
}

/**
 * Sign a payload with HMAC-SHA256. Returns "<payload>.<signature>".
 * Payload is base64url-encoded JSON.
 */
function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', getSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

/** Verify + decode a signed token. Returns null if invalid or expired. */
function verify<T = unknown>(token: string | undefined | null): T | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  const expected = createHmac('sha256', getSecret()).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      userId: string
      exp: number
    } & T
    if (Date.now() > payload.exp) return null
    return payload as T
  } catch {
    return null
  }
}

export interface SessionPayload {
  userId: string
  email: string
  exp: number
}

/** Create a session token for a user (used by /api/auth/login & /signup). */
export function createSessionToken(userId: string, email: string): string {
  return sign({
    userId,
    email,
    exp: Date.now() + SESSION_TTL * 1000,
  })
}

/** Read & verify the current session from the request cookies. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  return verify<SessionPayload>(token)
}

/** Set the session cookie on the response. */
export async function setSessionCookie(userId: string, email: string): Promise<void> {
  const store = await cookies()
  const token = createSessionToken(userId, email)
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL,
  })
}

/** Clear the session cookie (logout). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/* ---------- Password hashing (scrypt, no external deps) ---------- */

const SCRYPT_KEYLEN = 64
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(plain, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString('hex')
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, derived] = parts
  const test = scryptSync(plain, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString('hex')
  const a = Buffer.from(test)
  const b = Buffer.from(derived)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Generate a new user id (cuid-style via crypto.randomUUID). */
export function newId(): string {
  return randomUUID()
}
