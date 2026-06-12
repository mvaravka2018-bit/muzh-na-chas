'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch } from '@/lib/api'

interface DashboardData {
  total_orders: number
  pending_orders: number
  verified_masters: number
  pending_applications: number
  pending_withdrawals: number
}

const CARDS: { key: keyof DashboardData; label: string }[] = [
  { key: 'total_orders', label: 'Всего заказов' },
  { key: 'pending_orders', label: 'Ожидают мастера' },
  { key: 'verified_masters', label: 'Подтверждённые мастера' },
  { key: 'pending_applications', label: 'Заявки на рассмотрении' },
  { key: 'pending_withdrawals', label: 'Заявки на вывод' },
]

export default function AdminDashboardPage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    apiFetch<DashboardData>('/api/admin/dashboard', accessToken)
      .then(setData)
      .catch(() => setError('Не удалось загрузить статистику'))
  }, [accessToken])

  if (authLoading || (!data && !error)) {
    return <div className="text-center text-tg-hint">Загрузка...</div>
  }

  if (error || !data) {
    return <div className="text-center text-tg-hint">{error}</div>
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {CARDS.map((card) => (
        <div key={card.key} className="rounded-xl bg-tg-secondary-bg p-4">
          <p className="text-2xl font-semibold">{data[card.key]}</p>
          <p className="text-sm text-tg-hint">{card.label}</p>
        </div>
      ))}
    </div>
  )
}
