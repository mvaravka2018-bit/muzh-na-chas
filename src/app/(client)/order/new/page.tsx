import { createAdminClient } from '@/lib/supabase/admin'
import { getDefaultCitySlug } from '@/lib/city'
import { OrderForm } from '@/components/app/OrderForm'

interface NewOrderPageProps {
  searchParams: Promise<{ category?: string }>
}

export default async function NewOrderPage({ searchParams }: NewOrderPageProps) {
  const { category } = await searchParams
  if (!category) {
    return <div className="p-4 text-center text-tg-hint">Выберите категорию услуги на главной</div>
  }

  const supabase = createAdminClient()
  const citySlug = getDefaultCitySlug()

  const { data: city } = await supabase.from('cities').select('id').eq('slug', citySlug).single()
  if (!city) {
    return <div className="p-4 text-center text-tg-hint">Город не найден</div>
  }

  const { data: categoryRow, error } = await supabase
    .from('categories')
    .select('id, name')
    .eq('city_id', city.id)
    .eq('slug', category)
    .single()

  if (error || !categoryRow) {
    return <div className="p-4 text-center text-tg-hint">Категория не найдена</div>
  }

  return (
    <div>
      <header className="p-4 border-b border-tg-hint/20">
        <h1 className="text-lg font-semibold">Новый заказ · {categoryRow.name}</h1>
      </header>
      <OrderForm categoryId={categoryRow.id} />
    </div>
  )
}
