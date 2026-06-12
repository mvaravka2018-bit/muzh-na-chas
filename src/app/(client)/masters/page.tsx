import { createAdminClient } from '@/lib/supabase/admin'
import { getDefaultCitySlug } from '@/lib/city'
import { MasterCard } from '@/components/app/MasterCard'
import type { Master } from '@/types'

interface MastersPageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function MastersPage({ searchParams }: MastersPageProps) {
  const { category } = await searchParams
  const supabase = createAdminClient()
  const citySlug = getDefaultCitySlug()

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id')
    .eq('slug', citySlug)
    .eq('is_active', true)
    .single()

  if (cityError || !city) {
    return <div className="p-4 text-center text-tg-hint">Город не найден</div>
  }

  let query = supabase
    .from('masters')
    .select('*, user:users(first_name, avatar_url), master_categories(custom_price, category:categories(name, slug))')
    .eq('city_id', city.id)
    .eq('is_verified', true)
    .order('is_available', { ascending: false })
    .order('rating', { ascending: false })

  if (category) {
    const { data: categoryRow } = await supabase
      .from('categories')
      .select('id')
      .eq('city_id', city.id)
      .eq('slug', category)
      .single()

    if (categoryRow) {
      const { data: masterIds } = await supabase
        .from('master_categories')
        .select('master_id')
        .eq('category_id', categoryRow.id)

      const ids = (masterIds ?? []).map((m) => m.master_id)
      query = query.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
    }
  }

  const { data: masters, error } = await query

  if (error) {
    return <div className="p-4 text-center text-tg-hint">Ошибка загрузки мастеров</div>
  }

  if (!masters?.length) {
    return <div className="p-4 text-center text-tg-hint py-12">Мастера не найдены</div>
  }

  return (
    <div className="p-4 space-y-3">
      {(masters as unknown as Master[]).map((master) => (
        <MasterCard key={master.id} master={master} />
      ))}
    </div>
  )
}
