import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/supabase/jwt'

const BodySchema = z.object({
  refresh_token: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const payload = verifyRefreshToken(parsed.data.refresh_token)
  if (!payload) {
    return NextResponse.json({ error: 'token_expired' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, role, city_id, is_blocked')
    .eq('id', payload.sub)
    .single()

  if (error || !user) {
    return NextResponse.json({ error: 'token_expired' }, { status: 401 })
  }
  if (user.is_blocked) {
    return NextResponse.json({ error: 'user_blocked' }, { status: 403 })
  }

  return NextResponse.json({
    access_token: signAccessToken({ sub: user.id, role: user.role, city_id: user.city_id }),
    refresh_token: signRefreshToken(user.id),
  })
}
