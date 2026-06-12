import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'city_admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const supabase = createAdminClient()
  const cityFilter = auth.role === 'city_admin' ? { city_id: auth.cityId } : undefined

  const ordersQuery = supabase.from('orders').select('id', { count: 'exact', head: true })
  const pendingOrdersQuery = supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  const mastersQuery = supabase.from('masters').select('id', { count: 'exact', head: true }).eq('is_verified', true)
  const applicationsQuery = supabase.from('master_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  const withdrawalsQuery = supabase.from('withdrawal_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')

  if (cityFilter) {
    ordersQuery.eq('city_id', cityFilter.city_id)
    pendingOrdersQuery.eq('city_id', cityFilter.city_id)
    mastersQuery.eq('city_id', cityFilter.city_id)
    applicationsQuery.eq('city_id', cityFilter.city_id)
  }

  const [{ count: totalOrders }, { count: pendingOrders }, { count: verifiedMasters }, { count: pendingApplications }, { count: pendingWithdrawals }] =
    await Promise.all([ordersQuery, pendingOrdersQuery, mastersQuery, applicationsQuery, withdrawalsQuery])

  return NextResponse.json({
    total_orders: totalOrders ?? 0,
    pending_orders: pendingOrders ?? 0,
    verified_masters: verifiedMasters ?? 0,
    pending_applications: pendingApplications ?? 0,
    pending_withdrawals: pendingWithdrawals ?? 0,
  })
}
