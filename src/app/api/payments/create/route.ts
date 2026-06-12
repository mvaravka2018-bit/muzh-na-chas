import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { createPayment } from '@/lib/yookassa'

const BodySchema = z.object({
  order_id: z.string().uuid(),
  return_url: z.string().url(),
})

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'client') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, client_id, total_amount, category:categories(name)')
    .eq('id', parsed.data.order_id)
    .single()

  if (orderError || !order || order.client_id !== auth.userId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (!order.total_amount) {
    return NextResponse.json({ error: 'order_amount_not_set' }, { status: 400 })
  }

  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id, status')
    .eq('order_id', order.id)
    .eq('status', 'succeeded')
    .maybeSingle()

  if (existingPayment) {
    return NextResponse.json({ error: 'order_already_paid' }, { status: 400 })
  }

  let payment
  try {
    payment = await createPayment(
      order.id,
      Number(order.total_amount),
      `Заказ #${order.id.slice(0, 8)} — ${(order.category as unknown as { name: string }[])?.[0]?.name ?? ''}`,
      parsed.data.return_url
    )
  } catch (error) {
    console.error('yookassa_create_payment_failed', error)
    return NextResponse.json({ error: 'payment_provider_unavailable' }, { status: 502 })
  }

  await supabase.from('payments').insert({
    order_id: order.id,
    provider: 'yookassa',
    amount: order.total_amount,
    status: 'pending',
    provider_payment_id: payment.id,
    provider_data: payment as unknown as Record<string, unknown>,
  })

  return NextResponse.json({
    payment_url: payment.confirmation?.confirmation_url,
    payment_id: payment.id,
  }, { status: 201 })
}
