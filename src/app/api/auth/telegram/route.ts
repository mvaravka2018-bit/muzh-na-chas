import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateTelegramInitData } from '@/lib/telegram'
import { signAccessToken, signRefreshToken } from '@/lib/supabase/jwt'

const BodySchema = z.object({
  initData: z.string().min(1),
  city_slug: z.string().regex(/^[a-z0-9-]+$/),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id, bot_token, is_active')
    .eq('slug', parsed.data.city_slug)
    .single()

  if (cityError || !city) {
    return NextResponse.json({ error: 'city_not_found' }, { status: 404 })
  }
  if (!city.is_active) {
    return NextResponse.json({ error: 'city_inactive' }, { status: 403 })
  }

  const validation = validateTelegramInitData(parsed.data.initData, city.bot_token)
  if (!validation.ok || !validation.user) {
    const status = validation.error === 'init_data_expired' ? 400 : 400
    return NextResponse.json({ error: validation.error ?? 'invalid_init_data' }, { status })
  }

  const tgUser = validation.user

  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', tgUser.id)
    .maybeSingle()

  if (existingUser?.is_blocked) {
    return NextResponse.json({ error: 'user_blocked' }, { status: 403 })
  }

  let userRow = existingUser
  if (existingUser) {
    const { data: updated, error: updateError } = await supabase
      .from('users')
      .update({
        first_name: tgUser.first_name,
        last_name: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', existingUser.id)
      .select('*')
      .single()

    if (updateError || !updated) {
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }
    userRow = updated
  } else {
    const { data: created, error: insertError } = await supabase
      .from('users')
      .insert({
        telegram_id: tgUser.id,
        city_id: city.id,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name ?? null,
        username: tgUser.username ?? null,
        last_seen_at: new Date().toISOString(),
      })
      .select('*')
      .single()

    if (insertError || !created) {
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }
    userRow = created
  }

  if (!userRow) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  const access_token = signAccessToken({
    sub: userRow.id,
    role: userRow.role,
    city_id: userRow.city_id,
  })
  const refresh_token = signRefreshToken(userRow.id)

  return NextResponse.json({
    access_token,
    refresh_token,
    user: { id: userRow.id, role: userRow.role, city_id: userRow.city_id },
  })
}
