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
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  let query = supabase
    .from('withdrawal_requests')
    .select('*, master:masters(id, city_id, user:users(first_name, phone))')
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })

  const filtered = auth.role === 'superadmin'
    ? data
    : data?.filter((w) => (w.master as unknown as { city_id: string })?.city_id === auth.cityId)

  return NextResponse.json({ data: filtered })
}
