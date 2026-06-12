'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch } from '@/lib/api'
import { StatusBadge } from '@/components/app/StatusBadge'
import { StatusTimeline } from '@/components/app/StatusTimeline'
import type { Order, OrderStatus } from '@/types'

interface OrderDetail extends Order {
  category: { name: string; icon_emoji: string }
  client: { first_name: string; phone: string | null }
  photos: { id: string; image_url: string }[]
  status_history: { status: OrderStatus; note: string | null; created_at: string }[]
}

export default function MasterOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, loading: authLoading } = useAuth()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<OrderDetail>(`/api/orders/${id}`, accessToken)
      .then(setOrder)
      .catch(() => setError('Не удалось загрузить заказ'))
  }, [accessToken, id])

  useEffect(() => {
    load()
  }, [load])

  if (authLoading || (!order && !error)) {
    return <div className="p-4 text-center text-tg-hint">Загрузка...</div>
  }

  if (error || !order) {
    return <div className="p-4 text-center text-tg-hint">{error}</div>
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">
          {order.category.icon_emoji} {order.category.name}
        </h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="space-y-1 text-sm">
        <p>{order.description}</p>
        <p className="text-tg-hint">📍 {order.address}</p>
        <p className="text-tg-hint">🕐 {new Date(order.scheduled_at).toLocaleString('ru-RU')}</p>
        <p className="text-tg-hint">
          Клиент: {order.client.first_name} {order.client.phone ? `· ${order.client.phone}` : ''}
        </p>
        {order.total_amount && <p className="font-medium">Сумма: {order.total_amount} ₽</p>}
      </div>

      {!!order.photos.length && (
        <div>
          <h2 className="font-medium mb-2">Фото</h2>
          <div className="grid grid-cols-3 gap-2">
            {order.photos.map((photo) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={photo.id} src={photo.image_url} alt="" className="aspect-square object-cover rounded-lg" />
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-medium mb-2">История статусов</h2>
        <StatusTimeline history={order.status_history} />
      </div>
    </div>
  )
}
