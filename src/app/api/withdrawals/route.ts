import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const MIN_WITHDRAWAL_AMOUNT = 500

const BodySchema = z.object({
  amount: z.coerce.number().positive(),
  bank_details: z.object({
    bank_name: z.string().min(1),
    account_number: z.string().min(1),
    recipient_name: z.string().min(1),
  }).passthrough(),
})

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.amount < MIN_WITHDRAWAL_AMOUNT) {
    return NextResponse.json({ error: 'amount_below_minimum', min_amount: MIN_WITHDRAWAL_AMOUNT }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: master, error: masterError } = await supabase
    .from('masters')
    .select('id, balance')
    .eq('user_id', auth.userId)
    .single()

  if (masterError || !master) {
    return NextResponse.json({ error: 'master_not_found' }, { status: 404 })
  }

  if (Number(master.balance) < parsed.data.amount) {
    return NextResponse.json({ error: 'insufficient_balance' }, { status: 400 })
  }

  const { data: withdrawal, error: insertError } = await supabase
    .from('withdrawal_requests')
    .insert({
      master_id: master.id,
      amount: parsed.data.amount,
      bank_details: parsed.data.bank_details,
      status: 'pending',
    })
    .select('*')
    .single()

  if (insertError || !withdrawal) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(withdrawal, { status: 201 })
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createAdminClient()

  const { data: master } = await supabase.from('masters').select('id').eq('user_id', auth.userId).single()
  if (!master) return NextResponse.json({ error: 'master_not_found' }, { status: 404 })

  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('master_id', master.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })

  return NextResponse.json({ data })
}
