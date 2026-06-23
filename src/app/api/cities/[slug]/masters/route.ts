import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const categorySlug = searchParams.get('category_slug')
  const availableOnly = searchParams.get('available_only') === 'true'
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') ?? '20')))

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

  let query = supabase
    .from('masters')
    .select('id, bio, experience_years, is_available, rating, reviews_count, user:users(first_name, avatar_url), master_categories(custom_price, category:categories(name, slug))', { count: 'exact' })
    .eq('city_id', city.id)
    .eq('is_verified', true)
    .order('is_available', { ascending: false })
    .order('rating', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (availableOnly) {
    query = query.eq('is_available', true)
  }

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })

  let filtered = data ?? []
  if (categorySlug) {
    filtered = filtered.filter((m) =>
      (m.master_categories as unknown as { category: { slug: string } }[])?.some(
        (mc) => mc.category.slug === categorySlug
      )
    )
  }

  return NextResponse.json({ data: filtered, total: count ?? 0, page })
}
