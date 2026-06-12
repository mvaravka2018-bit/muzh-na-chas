import jwt from 'jsonwebtoken'

export interface AppJwtClaims {
  sub: string
  role: string
  city_id: string
  aud: string
}

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30

function getSecret(): string {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) throw new Error('SUPABASE_JWT_SECRET is not set')
  return secret
}

export function signAccessToken(claims: Omit<AppJwtClaims, 'aud'>): string {
  return jwt.sign({ ...claims, aud: 'authenticated' }, getSecret(), {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  })
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, type: 'refresh' }, getSecret(), {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  })
}

export function verifyRefreshToken(token: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload
    if (payload.type !== 'refresh' || typeof payload.sub !== 'string') return null
    return { sub: payload.sub }
  } catch {
    return null
  }
}

export function verifyAccessToken(token: string): AppJwtClaims | null {
  try {
    const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string' || typeof payload.city_id !== 'string') {
      return null
    }
    return { sub: payload.sub, role: payload.role, city_id: payload.city_id, aud: String(payload.aud) }
  } catch {
    return null
  }
}
