import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('category_templates')
    .select('id, slug, name, icon_emoji, base_price')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })

  return NextResponse.json(data)
}
