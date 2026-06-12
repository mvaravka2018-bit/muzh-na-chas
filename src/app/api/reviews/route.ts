import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  order_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
})

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, client_id, master_id, status')
    .eq('id', parsed.data.order_id)
    .single()

  if (orderError || !order || order.client_id !== auth.userId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (order.status !== 'confirmed') {
    return NextResponse.json({ error: 'order_not_confirmed' }, { status: 400 })
  }
  if (!order.master_id) {
    return NextResponse.json({ error: 'order_not_confirmed' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'review_exists' }, { status: 409 })
  }

  const { data: review, error } = await supabase
    .from('reviews')
    .insert({
      order_id: order.id,
      client_id: auth.userId,
      master_id: order.master_id,
      rating: parsed.data.rating,
      comment: parsed.data.comment ?? null,
    })
    .select('id')
    .single()

  if (error || !review) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(review, { status: 201 })
}
