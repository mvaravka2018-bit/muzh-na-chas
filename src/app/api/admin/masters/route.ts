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

  let query = supabase
    .from('masters')
    .select('id, bio, is_verified, is_available, rating, reviews_count, balance, user:users(first_name, phone)')
    .order('created_at', { ascending: false })

  if (auth.role === 'city_admin') {
    query = query.eq('city_id', auth.cityId)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })

  return NextResponse.json({ data })
}
