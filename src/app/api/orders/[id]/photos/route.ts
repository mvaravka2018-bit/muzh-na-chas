import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const MAX_PHOTOS = 5
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, client_id, master_id')
    .eq('id', id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  let isOwnerMaster = false
  if (order.master_id) {
    const { data: master } = await supabase.from('masters').select('user_id').eq('id', order.master_id).single()
    isOwnerMaster = master?.user_id === auth.userId
  }

  if (order.client_id !== auth.userId && !isOwnerMaster) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { count } = await supabase
    .from('order_photos')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', id)

  if ((count ?? 0) >= MAX_PHOTOS) {
    return NextResponse.json({ error: 'photo_limit_reached' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('orders')
    .upload(path, await file.arrayBuffer(), { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
  }

  const { data: publicUrl } = supabase.storage.from('orders').getPublicUrl(path)

  const { error: insertError } = await supabase.from('order_photos').insert({
    order_id: id,
    image_url: publicUrl.publicUrl,
    uploaded_by: auth.userId,
  })

  if (insertError) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json({ image_url: publicUrl.publicUrl }, { status: 201 })
}
