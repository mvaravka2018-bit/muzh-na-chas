import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select(
      `*, category:categories(name, icon_emoji),
       client:users!orders_client_id_fkey(first_name, phone),
       master:masters(id, user:users(first_name, phone)),
       photos:order_photos(id, image_url, uploaded_by, created_at),
       status_history:order_status_history(status, note, created_at)`
    )
    .eq('id', id)
    .single()

  if (error || !order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const isClient = order.client_id === auth.userId
  let isOwnerMaster = false
  if (order.master_id) {
    const { data: master } = await supabase
      .from('masters')
      .select('user_id')
      .eq('id', order.master_id)
      .single()
    isOwnerMaster = master?.user_id === auth.userId
  }
  const isAdmin = auth.role === 'superadmin' || (auth.role === 'city_admin' && order.city_id === auth.cityId)

  if (!isClient && !isOwnerMaster && !isAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  return NextResponse.json(order)
}
