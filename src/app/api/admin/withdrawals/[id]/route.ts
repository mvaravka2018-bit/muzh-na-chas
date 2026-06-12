import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { notify } from '@/lib/notify'

const BodySchema = z.object({
  status: z.enum(['processing', 'completed', 'rejected']),
  admin_note: z.string().max(1000).optional(),
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

  const { data: withdrawal, error: withdrawalError } = await supabase
    .from('withdrawal_requests')
    .select('*, master:masters(id, city_id, user_id, balance)')
    .eq('id', id)
    .single()

  if (withdrawalError || !withdrawal) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const master = withdrawal.master as unknown as { id: string; city_id: string; user_id: string; balance: number }

  if (auth.role === 'city_admin' && master.city_id !== auth.cityId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
    return NextResponse.json({ error: 'already_processed' }, { status: 400 })
  }

  const update: Record<string, unknown> = {
    status: parsed.data.status,
    admin_note: parsed.data.admin_note ?? null,
    processed_by: auth.userId,
    processed_at: new Date().toISOString(),
  }

  if (parsed.data.status === 'completed') {
    if (Number(master.balance) < Number(withdrawal.amount)) {
      return NextResponse.json({ error: 'insufficient_balance' }, { status: 400 })
    }
    await supabase
      .from('masters')
      .update({ balance: Number(master.balance) - Number(withdrawal.amount) })
      .eq('id', master.id)
  }

  const { data: updated, error: updateError } = await supabase
    .from('withdrawal_requests')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  if (parsed.data.status === 'completed' || parsed.data.status === 'rejected') {
    await notify({ event: 'withdrawal_processed', user_id: master.user_id, extra: { status: parsed.data.status, amount: withdrawal.amount } })
  }

  return NextResponse.json(updated)
}
