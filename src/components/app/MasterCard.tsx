import Link from 'next/link'
import { Star } from 'lucide-react'
import type { Master } from '@/types'

interface MasterCardProps {
  master: Master
}

export function MasterCard({ master }: MasterCardProps) {
  return (
    <Link
      href={`/masters/${master.id}`}
      className="flex items-center gap-3 rounded-xl bg-tg-secondary-bg p-4 active:scale-95 transition-transform"
    >
      <img
        src={master.user.avatar_url ?? '/avatar-placeholder.png'}
        className="w-12 h-12 rounded-full object-cover bg-tg-hint/20"
        alt=""
      />
      <div className="flex-1">
        <p className="font-medium">{master.user.first_name}</p>
        <div className="flex items-center gap-1 text-sm text-tg-hint">
          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
          <span>{master.rating.toFixed(1)}</span>
          <span>· {master.reviews_count} отзывов</span>
        </div>
        {master.master_categories?.length ? (
          <p className="text-sm text-tg-hint truncate">
            {master.master_categories.map((mc) => mc.category.name).join(', ')}
          </p>
        ) : null}
      </div>
      {master.is_available && (
        <span className="text-xs text-green-600 font-medium">Онлайн</span>
      )}
    </Link>
  )
}
