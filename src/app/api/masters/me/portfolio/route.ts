import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const MAX_ITEMS = 10
const MAX_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createAdminClient()

  const { data: master, error: masterError } = await supabase
    .from('masters')
    .select('id')
    .eq('user_id', auth.userId)
    .single()

  if (masterError || !master) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { count } = await supabase
    .from('master_portfolio')
    .select('id', { count: 'exact', head: true })
    .eq('master_id', master.id)

  if ((count ?? 0) >= MAX_ITEMS) {
    return NextResponse.json({ error: 'portfolio_limit_reached' }, { status: 400 })
  }

  const formData = await req.formData()
  const file = formData.get('file')
  const caption = formData.get('caption')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${master.id}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('portfolio')
    .upload(path, await file.arrayBuffer(), { contentType: file.type })

  if (uploadError) {
    return NextResponse.json({ error: 'upload_failed' }, { status: 500 })
  }

  const { data: publicUrl } = supabase.storage.from('portfolio').getPublicUrl(path)

  const { data: portfolioItem, error: insertError } = await supabase
    .from('master_portfolio')
    .insert({
      master_id: master.id,
      image_url: publicUrl.publicUrl,
      caption: typeof caption === 'string' && caption ? caption : null,
    })
    .select('*')
    .single()

  if (insertError || !portfolioItem) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(portfolioItem, { status: 201 })
}
