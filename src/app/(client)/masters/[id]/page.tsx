import { Star } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Master } from '@/types'

interface MasterProfilePageProps {
  params: Promise<{ id: string }>
}

export default async function MasterProfilePage({ params }: MasterProfilePageProps) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: master, error } = await supabase
    .from('masters')
    .select(
      '*, user:users(first_name, avatar_url, phone), master_categories(custom_price, category:categories(name, base_price, price_label)), master_portfolio(image_url, caption)'
    )
    .eq('id', id)
    .eq('is_verified', true)
    .single()

  if (error || !master) {
    return <div className="p-4 text-center text-tg-hint">Мастер не найден</div>
  }

  const m = master as unknown as Master

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <img
          src={m.user.avatar_url ?? '/avatar-placeholder.png'}
          className="w-16 h-16 rounded-full object-cover bg-tg-hint/20"
          alt=""
        />
        <div>
          <h1 className="text-lg font-semibold">{m.user.first_name}</h1>
          <div className="flex items-center gap-1 text-sm text-tg-hint">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span>{m.rating.toFixed(1)}</span>
            <span>· {m.reviews_count} отзывов</span>
            <span>· {m.experience_years} лет опыта</span>
          </div>
        </div>
      </div>

      {m.bio && <p className="text-sm">{m.bio}</p>}

      <div>
        <h2 className="font-medium mb-2">Услуги</h2>
        <ul className="space-y-1">
          {m.master_categories?.map((mc, i) => (
            <li key={i} className="flex justify-between text-sm bg-tg-secondary-bg rounded-lg px-3 py-2">
              <span>{mc.category.name}</span>
              <span className="text-tg-hint">
                {(mc.custom_price ?? mc.category.base_price ?? 0) > 0
                  ? `${mc.custom_price ?? mc.category.base_price} ₽`
                  : mc.category.price_label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {!!m.master_portfolio?.length && (
        <div>
          <h2 className="font-medium mb-2">Портфолио</h2>
          <div className="grid grid-cols-3 gap-2">
            {m.master_portfolio.map((p, i) => (
              <img key={i} src={p.image_url} alt={p.caption ?? ''} className="aspect-square object-cover rounded-lg" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
