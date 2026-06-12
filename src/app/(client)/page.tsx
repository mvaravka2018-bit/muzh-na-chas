import { createAdminClient } from '@/lib/supabase/admin'
import { getDefaultCitySlug } from '@/lib/city'
import { CategoryGrid } from '@/components/app/CategoryGrid'

export default async function HomePage() {
  const supabase = createAdminClient()
  const citySlug = getDefaultCitySlug()

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id, name')
    .eq('slug', citySlug)
    .eq('is_active', true)
    .single()

  if (cityError || !city) {
    return <div className="p-4 text-center text-tg-hint">Город не найден</div>
  }

  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('city_id', city.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return <div className="p-4 text-center text-tg-hint">Ошибка загрузки категорий</div>
  }

  return (
    <div>
      <header className="p-4 border-b border-tg-hint/20">
        <h1 className="text-xl font-semibold">Муж на час · {city.name}</h1>
        <p className="text-sm text-tg-hint">Выберите услугу</p>
      </header>
      <CategoryGrid categories={categories ?? []} />
    </div>
  )
}
