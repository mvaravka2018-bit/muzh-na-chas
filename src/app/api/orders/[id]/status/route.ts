import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { isTransitionAllowed, NOTIFY_EVENT_BY_STATUS } from '@/lib/orders'
import { notify } from '@/lib/notify'
import type { OrderStatus } from '@/types'

const BodySchema = z.object({
  status: z.enum(['pending', 'accepted', 'in_progress', 'completed', 'confirmed', 'cancelled', 'disputed']),
  note: z.string().max(1000).optional(),
  total_amount: z.coerce.number().positive().optional(),
  cancel_reason: z.string().max(500).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  let masterUserId: string | null = null
  if (order.master_id) {
    const { data: master } = await supabase.from('masters').select('user_id, balance').eq('id', order.master_id).single()
    masterUserId = master?.user_id ?? null
  }

  const isClient = order.client_id === auth.userId
  const isOwnerMaster = order.master_id !== null && masterUserId === auth.userId
  const isAdmin = auth.role === 'superadmin' || (auth.role === 'city_admin' && order.city_id === auth.cityId)
  const isAcceptingMaster = order.status === 'pending' && order.master_id === null && auth.role === 'master' && parsed.data.status === 'accepted'

  if (!isClient && !isOwnerMaster && !isAdmin && !isAcceptingMaster) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const newStatus: OrderStatus = parsed.data.status

  if (!isAdmin) {
    if (!isTransitionAllowed(auth.role, order.status, newStatus)) {
      return NextResponse.json({ error: 'invalid_status_transition' }, { status: 400 })
    }
  }

  if (order.status === 'confirmed') {
    return NextResponse.json({ error: 'cannot_cancel_confirmed' }, { status: 400 })
  }

  const update: Record<string, unknown> = { status: newStatus }
  const now = new Date().toISOString()

  if (isAcceptingMaster) {
    const { data: acceptingMaster, error: masterError } = await supabase
      .from('masters')
      .select('id, city_id, is_verified, balance')
      .eq('user_id', auth.userId)
      .single()

    if (masterError || !acceptingMaster || acceptingMaster.city_id !== order.city_id) {
      return NextResponse.json({ error: 'wrong_city' }, { status: 403 })
    }
    if (!acceptingMaster.is_verified) {
      return NextResponse.json({ error: 'master_not_verified' }, { status: 403 })
    }
    if (acceptingMaster.balance < 0) {
      return NextResponse.json({ error: 'negative_balance' }, { status: 403 })
    }
    update.master_id = acceptingMaster.id
    update.accepted_at = now
  }

  if (newStatus === 'accepted' && !isAcceptingMaster) update.accepted_at = now
  if (newStatus === 'in_progress') {
    // no extra fields
  }
  if (newStatus === 'completed') {
    if (parsed.data.total_amount === undefined) {
      return NextResponse.json({ error: 'total_amount_required' }, { status: 400 })
    }
    update.total_amount = parsed.data.total_amount
    update.completed_at = now
  }
  if (newStatus === 'confirmed') {
    update.confirmed_at = now
  }
  if (newStatus === 'cancelled') {
    update.cancelled_by = auth.userId
    update.cancel_reason = parsed.data.cancel_reason ?? parsed.data.note ?? null
  }
  if (parsed.data.note) {
    update.master_note = parsed.data.note
  }

  const { data: updated, error: updateError } = await supabase
    .from('orders')
    .update(update)
    .eq('id', id)
    .select('id, status')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  if (newStatus === 'confirmed') {
    await chargeCommission(id)
    if (order.payment_type === 'cash') {
      const finalAmount = update.total_amount ?? order.total_amount ?? 0
      await supabase.from('payments').insert({
        order_id: id,
        provider: 'cash',
        amount: finalAmount,
        status: 'succeeded',
      })
    }
  }

  const event = NOTIFY_EVENT_BY_STATUS[newStatus]
  if (event) {
    await notify({
      event: event as Parameters<typeof notify>[0]['event'],
      order_id: id,
      extra: {
        total_amount: update.total_amount ?? order.total_amount,
        reason: update.cancel_reason ?? undefined,
      },
    })
  }

  return NextResponse.json(updated)
}

async function chargeCommission(orderId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.INTERNAL_API_SECRET
  if (!supabaseUrl || !secret) return

  try {
    await fetch(`${supabaseUrl}/functions/v1/commission`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify({ order_id: orderId }),
    })
  } catch (error) {
    console.error('commission_charge_failed', error)
  }
}
