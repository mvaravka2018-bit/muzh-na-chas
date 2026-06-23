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

  const { data, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, is_visible, created_at, client:users!reviews_client_id_fkey(first_name), master:masters(user:users(first_name))')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    const { data: fallback, error: fallbackError } = await supabase
      .from('reviews')
      .select('id, rating, comment, is_visible, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (fallbackError) return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    return NextResponse.json({ data: fallback })
  }

  return NextResponse.json({ data })
}
