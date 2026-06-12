import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createAdminClient()

  const { data: master, error: masterError } = await supabase
    .from('masters')
    .select('id, balance, total_earned')
    .eq('user_id', auth.userId)
    .single()

  if (masterError || !master) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { data: commissions } = await supabase
    .from('commission_transactions')
    .select('id, order_id, amount, rate, status, charged_at, created_at')
    .eq('master_id', master.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: withdrawals } = await supabase
    .from('withdrawal_requests')
    .select('id, amount, status, created_at, processed_at')
    .eq('master_id', master.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({
    balance: master.balance,
    total_earned: master.total_earned,
    commissions: commissions ?? [],
    withdrawals: withdrawals ?? [],
  })
}
