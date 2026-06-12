import Link from 'next/link'
import { StatusBadge } from '@/components/app/StatusBadge'
import type { Order } from '@/types'

interface OrderListItem extends Order {
  category?: { name: string; icon_emoji: string }
}

export function OrderCard({ order, href }: { order: OrderListItem; href: string }) {
  return (
    <Link href={href} className="block rounded-xl bg-tg-secondary-bg p-4 active:scale-95 transition-transform">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">
          {order.category?.icon_emoji} {order.category?.name ?? 'Заказ'}
        </span>
        <StatusBadge status={order.status} />
      </div>
      <p className="text-sm text-tg-hint truncate">{order.address}</p>
      <p className="text-sm text-tg-hint">{new Date(order.scheduled_at).toLocaleString('ru-RU')}</p>
    </Link>
  )
}
