import { StatusBadge } from '@/components/app/StatusBadge'
import type { OrderStatus } from '@/types'

interface HistoryItem {
  status: OrderStatus
  note: string | null
  created_at: string
}

export function StatusTimeline({ history }: { history: HistoryItem[] }) {
  if (!history.length) return null

  return (
    <ul className="space-y-2">
      {history.map((item, i) => (
        <li key={i} className="flex items-center justify-between text-sm">
          <StatusBadge status={item.status} />
          <span className="text-tg-hint">{new Date(item.created_at).toLocaleString('ru-RU')}</span>
        </li>
      ))}
    </ul>
  )
}
