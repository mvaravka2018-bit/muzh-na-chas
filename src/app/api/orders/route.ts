import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { notify } from '@/lib/notify'

const CreateOrderSchema = z.object({
  category_id: z.string().uuid(),
  description: z.string().min(10).max(1000),
  address: z.string().min(5),
  lat: z.number().optional(),
  lng: z.number().optional(),
  scheduled_at: z.string().datetime(),
  master_id: z.string().uuid().optional(),
  payment_type: z.enum(['cash', 'online']),
  client_note: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'client') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const scheduledAt = new Date(parsed.data.scheduled_at)
  if (scheduledAt.getTime() < Date.now()) {
    return NextResponse.json({ error: 'scheduled_at_in_past' }, { status: 400 })
  }
  if (scheduledAt.getTime() < Date.now() + 30 * 60 * 1000) {
    return NextResponse.json({ error: 'too_soon' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id, city_id')
    .eq('id', parsed.data.category_id)
    .eq('city_id', auth.cityId)
    .eq('is_active', true)
    .single()

  if (categoryError || !category) {
    return NextResponse.json({ error: 'category_not_found' }, { status: 404 })
  }

  if (parsed.data.master_id) {
    const { data: master, error: masterError } = await supabase
      .from('masters')
      .select('id, city_id, is_verified')
      .eq('id', parsed.data.master_id)
      .single()

    if (masterError || !master || master.city_id !== auth.cityId) {
      return NextResponse.json({ error: 'wrong_city' }, { status: 403 })
    }
    if (!master.is_verified) {
      return NextResponse.json({ error: 'master_not_verified' }, { status: 403 })
    }
  }

  const { data: conflict } = await supabase
    .from('orders')
    .select('id')
    .eq('client_id', auth.userId)
    .eq('scheduled_at', parsed.data.scheduled_at)
    .not('status', 'in', '(cancelled,confirmed)')
    .maybeSingle()

  if (conflict) {
    return NextResponse.json({ error: 'time_conflict' }, { status: 409 })
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      city_id: auth.cityId,
      client_id: auth.userId,
      master_id: parsed.data.master_id ?? null,
      category_id: parsed.data.category_id,
      description: parsed.data.description,
      address: parsed.data.address,
      lat: parsed.data.lat ?? null,
      lng: parsed.data.lng ?? null,
      scheduled_at: parsed.data.scheduled_at,
      payment_type: parsed.data.payment_type,
      client_note: parsed.data.client_note ?? null,
    })
    .select('id, status')
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  await notify({
    event: 'order_new',
    order_id: order.id,
    user_id: parsed.data.master_id,
  })

  return NextResponse.json(order, { status: 201 })
}

const ListQuerySchema = z.object({
  role: z.enum(['client', 'master']),
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = ListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  let query = supabase
    .from('orders')
    .select('*, category:categories(name, icon_emoji)', { count: 'exact' })

  if (parsed.data.role === 'client') {
    query = query.eq('client_id', auth.userId)
  } else {
    if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const { data: master } = await supabase
      .from('masters')
      .select('id')
      .eq('user_id', auth.userId)
      .single()
    if (!master) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    query = query.eq('master_id', master.id)
  }

  if (parsed.data.status) {
    query = query.eq('status', parsed.data.status)
  }

  const from = (parsed.data.page - 1) * parsed.data.limit
  const to = from + parsed.data.limit - 1

  const { data, count, error } = await query
    .order('scheduled_at', { ascending: false })
    .range(from, to)

  if (error) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json({ data, total: count ?? 0 })
}
