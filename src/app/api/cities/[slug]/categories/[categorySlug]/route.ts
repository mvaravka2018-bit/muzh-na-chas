import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; categorySlug: string }> }
) {
  const { slug, categorySlug } = await params
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

  const { data: category, error } = await supabase
    .from('categories')
    .select('id, slug, name, description, base_price, price_label')
    .eq('city_id', city.id)
    .eq('slug', categorySlug)
    .eq('is_active', true)
    .single()

  if (error || !category) {
    return NextResponse.json({ error: 'category_not_found' }, { status: 404 })
  }

  return NextResponse.json(category)
}
