interface Commission {
  id: string
  amount: number
  rate: number
  status: string
  created_at: string
}

interface Withdrawal {
  id: string
  amount: number
  status: string
  created_at: string
}

const WITHDRAWAL_LABELS: Record<string, string> = {
  pending: 'На рассмотрении',
  processing: 'В обработке',
  completed: 'Выполнена',
  rejected: 'Отклонена',
}

export function TransactionsList({ commissions, withdrawals }: { commissions: Commission[]; withdrawals: Withdrawal[] }) {
  const items = [
    ...commissions.map((c) => ({
      id: `c-${c.id}`,
      label: `Комиссия (${(c.rate * 100).toFixed(0)}%)`,
      amount: -c.amount,
      date: c.created_at,
    })),
    ...withdrawals.map((w) => ({
      id: `w-${w.id}`,
      label: `Вывод средств · ${WITHDRAWAL_LABELS[w.status] ?? w.status}`,
      amount: -w.amount,
      date: w.created_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  if (!items.length) {
    return <p className="text-tg-hint text-sm">Пока нет операций</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between rounded-xl bg-tg-secondary-bg p-3">
          <div>
            <p className="text-sm">{item.label}</p>
            <p className="text-xs text-tg-hint">{new Date(item.date).toLocaleString('ru-RU')}</p>
          </div>
          <p className={item.amount < 0 ? 'text-red-500' : 'text-green-600'}>
            {item.amount > 0 ? '+' : ''}{item.amount} ₽
          </p>
        </div>
      ))}
    </div>
  )
}
