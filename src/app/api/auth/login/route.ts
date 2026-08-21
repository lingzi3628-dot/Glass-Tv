import { NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { badRequest } from '@/lib/api-auth'
import { setSessionCookie, verifyPassword } from '@/lib/session'

interface LoginBody {
  email?: unknown
  password?: unknown
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !password) {
      return badRequest('email and password are required')
    }

    const user = await db.user.findUnique({
      where: { email },
      include: { preferences: true },
    })
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    await setSessionCookie(user.id, user.email)

    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatar: user.avatar,
          onboardingCompleted: user.preferences?.onboardingCompleted ?? false,
        },
      },
      { status: 200 },
    )
  } catch (err) {
    console.error('[api/auth/login] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
