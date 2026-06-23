import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  base_price: z.coerce.number().min(0).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.coerce.number().int().optional(),
  description: z.string().max(1000).optional(),
  icon_emoji: z.string().max(10).optional(),
  price_label: z.string().max(50).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'city_admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (auth.role === 'city_admin') {
    const { data: category } = await supabase
      .from('categories')
      .select('city_id')
      .eq('id', id)
      .single()

    if (!category || category.city_id !== auth.cityId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const { data: updated, error } = await supabase
    .from('categories')
    .update(parsed.data)
    .eq('id', id)
    .select('id')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}
