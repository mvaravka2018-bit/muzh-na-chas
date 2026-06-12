import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  category_ids: z.array(z.string().uuid()).min(1).max(20),
})

export async function PUT(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: master, error: masterError } = await supabase
    .from('masters')
    .select('id')
    .eq('user_id', auth.userId)
    .single()

  if (masterError || !master) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  await supabase.from('master_categories').delete().eq('master_id', master.id)

  const rows = parsed.data.category_ids.map((categoryId) => ({
    master_id: master.id,
    category_id: categoryId,
  }))

  const { error: insertError } = await supabase.from('master_categories').insert(rows)

  if (insertError) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
