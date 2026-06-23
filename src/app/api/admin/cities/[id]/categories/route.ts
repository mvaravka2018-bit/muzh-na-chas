import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).min(2).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  icon_emoji: z.string().max(10).default('🔧'),
  base_price: z.coerce.number().min(0),
  price_label: z.string().max(50).default('от'),
  sort_order: z.coerce.number().int().default(0),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'city_admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id: cityId } = await params
  if (auth.role === 'city_admin' && auth.cityId !== cityId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: category, error } = await supabase
    .from('categories')
    .insert({ ...parsed.data, city_id: cityId })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'slug_taken' }, { status: 400 })
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(category, { status: 201 })
}
