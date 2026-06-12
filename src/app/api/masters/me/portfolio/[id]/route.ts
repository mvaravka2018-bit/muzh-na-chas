import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: master } = await supabase.from('masters').select('id').eq('user_id', auth.userId).single()
  if (!master) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { error } = await supabase
    .from('master_portfolio')
    .delete()
    .eq('id', id)
    .eq('master_id', master.id)

  if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
