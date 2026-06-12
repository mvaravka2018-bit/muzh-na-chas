import { NextRequest } from 'next/server'
import type { UserRole } from '@/types'

export interface AuthContext {
  userId: string
  role: UserRole
  cityId: string
}

export function getAuthContext(req: NextRequest): AuthContext | null {
  const userId = req.headers.get('x-user-id')
  const role = req.headers.get('x-user-role') as UserRole | null
  const cityId = req.headers.get('x-city-id')
  if (!userId || !role || !cityId) return null
  return { userId, role, cityId }
}
