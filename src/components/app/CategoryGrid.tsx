import Link from 'next/link'
import type { Category } from '@/types'

interface CategoryGridProps {
  categories: Category[]
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  if (!categories.length) {
    return (
      <div className="text-center py-12 text-tg-hint">
        В вашем городе пока нет доступных категорий услуг
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 p-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/masters?category=${category.slug}`}
          className="flex flex-col gap-2 rounded-xl bg-tg-secondary-bg p-4 min-h-[44px] active:scale-95 transition-transform"
        >
          <span className="text-3xl">{category.icon_emoji}</span>
          <span className="font-medium">{category.name}</span>
          <span className="text-sm text-tg-hint">
            {category.price_label} {category.base_price > 0 ? `${category.base_price} ₽` : ''}
          </span>
        </Link>
      ))}
    </div>
  )
}
