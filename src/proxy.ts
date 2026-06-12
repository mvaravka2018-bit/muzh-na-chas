import { NextRequest, NextResponse } from 'next/server'
import { verifyAccessToken } from '@/lib/supabase/jwt'

const PROTECTED_PREFIXES = ['/api/orders', '/api/masters', '/api/withdrawals', '/api/reviews', '/api/admin', '/api/payments', '/api/master-applications']
const PUBLIC_API_PREFIXES = ['/api/auth', '/api/cities', '/api/payments/webhook', '/api/internal']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null
    const claims = token ? verifyAccessToken(token) : null

    if (!claims) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-user-id', claims.sub)
    requestHeaders.set('x-user-role', claims.role)
    requestHeaders.set('x-city-id', claims.city_id)

    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
