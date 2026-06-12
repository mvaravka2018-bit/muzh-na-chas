import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const internalSecret = Deno.env.get('INTERNAL_API_SECRET')
  if (!internalSecret || req.headers.get('x-internal-secret') !== internalSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { order_id } = await req.json()
  if (!order_id) {
    return new Response(JSON.stringify({ error: 'order_id_required' }), { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, master_id, total_amount, city_id, commission_amount')
    .eq('id', order_id)
    .single()

  if (orderError || !order) {
    return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404 })
  }

  if (!order.master_id || !order.total_amount) {
    return new Response(JSON.stringify({ error: 'order_not_ready' }), { status: 400 })
  }

  if (order.commission_amount !== null) {
    return new Response(JSON.stringify({ ok: true, already_charged: true }))
  }

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('commission_rate')
    .eq('id', order.city_id)
    .single()

  if (cityError || !city) {
    return new Response(JSON.stringify({ error: 'city_not_found' }), { status: 404 })
  }

  const rate = Number(city.commission_rate)
  const amount = Math.round(Number(order.total_amount) * rate * 100) / 100

  const { error: rpcError } = await supabase.rpc('charge_commission', {
    p_order_id: order.id,
    p_master_id: order.master_id,
    p_amount: amount,
    p_rate: rate,
  })

  if (rpcError) {
    return new Response(JSON.stringify({ error: 'charge_failed', details: rpcError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, amount, rate }))
})
