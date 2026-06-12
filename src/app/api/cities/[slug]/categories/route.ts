import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = createAdminClient()

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (cityError || !city) {
    return NextResponse.json({ error: 'city_not_found' }, { status: 404 })
  }

  const { data: categories, error } = await supabase
    .from('categories')
    .select('id, slug, name, icon_emoji, base_price, price_label')
    .eq('city_id', city.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(categories)
}
