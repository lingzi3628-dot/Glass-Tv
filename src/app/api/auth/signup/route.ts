import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { badRequest } from '@/lib/api-auth'
import { hashPassword, newId, setSessionCookie } from '@/lib/session'

interface SignupBody {
  name?: unknown
  email?: unknown
  password?: unknown
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SignupBody
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!name || !email || !password) {
      return badRequest('name, email and password are required')
    }
    if (password.length < 6) {
      return badRequest('password must be at least 6 characters')
    }

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'email already registered' }, { status: 409 })
    }

    const hashed = hashPassword(password)
    const user = await db.user.create({
      data: {
        id: newId(),
        email,
        displayName: name,
        password: hashed,
      },
    })

    await setSessionCookie(user.id, user.email)

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatar: user.avatar,
          // A brand-new user has no preferences yet.
          onboardingCompleted: false,
        },
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('[api/auth/signup] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
