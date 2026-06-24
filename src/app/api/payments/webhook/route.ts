import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notify } from '@/lib/notify'

const YOOKASSA_IP_PREFIXES = ['185.71.76.', '185.71.77.', '77.75.153.', '77.75.156.11', '77.75.156.35', '::ffff:77.75.156.11', '2a02:5180:']

function isAllowedIp(ip: string): boolean {
  return YOOKASSA_IP_PREFIXES.some((prefix) => ip.startsWith(prefix))
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
  if (!isAllowedIp(ip)) {
    return new NextResponse(null, { status: 403 })
  }

  const body = await req.json()
  const event = body?.event as string | undefined
  const obj = body?.object as { id?: string; status?: string; metadata?: { order_id?: string } } | undefined

  if (!obj?.id) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: payment } = await supabase
    .from('payments')
    .select('id, order_id, status')
    .eq('provider_payment_id', obj.id)
    .maybeSingle()

  if (!payment) {
    return NextResponse.json({ error: 'payment_not_found' }, { status: 404 })
  }

  if (payment.status === 'succeeded') {
    return NextResponse.json({ ok: true })
  }

  if (event === 'payment.succeeded') {
    const now = new Date().toISOString()
    await supabase
      .from('payments')
      .update({ status: 'succeeded', provider_data: body, updated_at: now })
      .eq('id', payment.id)

    await supabase
      .from('orders')
      .update({ status: 'confirmed', confirmed_at: now })
      .eq('id', payment.order_id)
      .in('status', ['completed'])

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const secret = process.env.INTERNAL_API_SECRET
    if (supabaseUrl && secret) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/commission`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-internal-secret': secret },
          body: JSON.stringify({ order_id: payment.order_id }),
        })
      } catch (err) {
        console.error('commission_charge_failed', err)
      }
    }

    await notify({ event: 'order_confirmed', order_id: payment.order_id, extra: { reason: 'payment_succeeded' } })
  } else if (event === 'payment.canceled') {
    await supabase
      .from('payments')
      .update({ status: 'cancelled', provider_data: body, updated_at: new Date().toISOString() })
      .eq('id', payment.id)
  }

  return NextResponse.json({ ok: true })
}
