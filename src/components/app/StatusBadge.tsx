import type { OrderStatus } from '@/types'
import { cn } from '@/lib/utils'

const LABELS: Record<OrderStatus, string> = {
  pending: 'Ожидает мастера',
  accepted: 'Принят',
  in_progress: 'В работе',
  completed: 'Выполнен',
  confirmed: 'Подтверждён',
  cancelled: 'Отменён',
  disputed: 'Спор',
}

const COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  disputed: 'bg-red-100 text-red-800',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn('text-xs font-medium px-2 py-1 rounded-full', COLORS[status])}>
      {LABELS[status]}
    </span>
  )
}
