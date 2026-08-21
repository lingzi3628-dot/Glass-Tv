import { NextResponse } from 'next/server'

import { clearSessionCookie } from '@/lib/session'

export async function POST() {
  try {
    await clearSessionCookie()
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[api/auth/logout] error', err)
    return NextResponse.json({ error: 'internal server error' }, { status: 500 })
  }
}
