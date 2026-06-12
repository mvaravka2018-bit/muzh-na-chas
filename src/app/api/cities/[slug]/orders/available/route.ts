import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { slug } = await params
  const supabase = createAdminClient()

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (cityError || !city || city.id !== auth.cityId) {
    return NextResponse.json({ error: 'city_not_found' }, { status: 404 })
  }

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, description, address, scheduled_at, category:categories(name, icon_emoji), client:users!orders_client_id_fkey(first_name)')
    .eq('city_id', city.id)
    .eq('status', 'pending')
    .is('master_id', null)
    .order('scheduled_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(orders)
}
