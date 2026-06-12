import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  bio: z.string().max(2000).optional(),
  experience_years: z.coerce.number().int().min(0).max(80).optional(),
  is_available: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createAdminClient()

  const { data: master, error } = await supabase
    .from('masters')
    .select('*, user:users(first_name, last_name, phone, avatar_url), master_categories(custom_price, category:categories(id, name, base_price, price_label)), master_portfolio(id, image_url, caption)')
    .eq('user_id', auth.userId)
    .single()

  if (error || !master) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(master)
}

export async function PATCH(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: updated, error } = await supabase
    .from('masters')
    .update(parsed.data)
    .eq('user_id', auth.userId)
    .select('*')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
