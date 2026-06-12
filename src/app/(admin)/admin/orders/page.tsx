'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch } from '@/lib/api'
import { StatusBadge } from '@/components/app/StatusBadge'
import type { OrderStatus } from '@/types'

interface AdminOrder {
  id: string
  status: OrderStatus
  address: string
  scheduled_at: string
  total_amount: number | null
  created_at: string
  category: { name: string; icon_emoji: string }
}

export default function AdminOrdersPage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<AdminOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    apiFetch<{ data: AdminOrder[] }>('/api/admin/orders', accessToken)
      .then((res) => setOrders(res.data))
      .catch(() => setError('Не удалось загрузить заказы'))
  }, [accessToken])

  if (authLoading || (!orders && !error)) {
    return <div className="text-center text-tg-hint">Загрузка...</div>
  }

  if (error) {
    return <div className="text-center text-tg-hint">{error}</div>
  }

  if (!orders?.length) {
    return <div className="text-center text-tg-hint py-12">Заказов нет</div>
  }

  return (
    <div className="space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="rounded-xl bg-tg-secondary-bg p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-medium">
              {order.category.icon_emoji} {order.category.name}
            </p>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-tg-hint">{order.address}</p>
          <p className="text-sm text-tg-hint">{new Date(order.scheduled_at).toLocaleString('ru-RU')}</p>
          {order.total_amount && <p className="text-sm font-medium">{order.total_amount} ₽</p>}
        </div>
      ))}
    </div>
  )
}
