'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch } from '@/lib/api'
import { OrderCard } from '@/components/app/OrderCard'
import type { Order } from '@/types'

interface OrderListItem extends Order {
  category?: { name: string; icon_emoji: string }
}

export default function ClientOrdersPage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<OrderListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    apiFetch<{ data: OrderListItem[] }>('/api/orders?role=client', accessToken)
      .then((res) => setOrders(res.data))
      .catch(() => setError('Не удалось загрузить заказы'))
  }, [accessToken])

  if (authLoading || (!orders && !error)) {
    return <div className="p-4 text-center text-tg-hint">Загрузка...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-tg-hint">{error}</div>
  }

  if (!orders?.length) {
    return <div className="p-4 text-center text-tg-hint py-12">У вас пока нет заказов</div>
  }

  return (
    <div className="p-4 space-y-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} href={`/orders/${order.id}`} />
      ))}
    </div>
  )
}
