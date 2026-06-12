import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cities')
    .select('id, slug, name, timezone, commission_rate')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'city_not_found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
