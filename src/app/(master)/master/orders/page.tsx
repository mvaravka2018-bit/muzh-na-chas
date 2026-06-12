'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'
import { getDefaultCitySlug } from '@/lib/city'

interface AvailableOrder {
  id: string
  description: string
  address: string
  scheduled_at: string
  category: { name: string; icon_emoji: string }
  client: { first_name: string }
}

export default function AvailableOrdersPage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<AvailableOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<AvailableOrder[]>(`/api/cities/${getDefaultCitySlug()}/orders/available`, accessToken)
      .then(setOrders)
      .catch(() => setError('Не удалось загрузить заказы'))
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  const accept = async (id: string) => {
    if (!accessToken) return
    setAcceptingId(id)
    try {
      await apiFetch(`/api/orders/${id}/status`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'accepted' }),
      })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось принять заказ')
    } finally {
      setAcceptingId(null)
    }
  }

  if (authLoading || (!orders && !error)) {
    return <div className="p-4 text-center text-tg-hint">Загрузка...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-tg-hint">{error}</div>
  }

  if (!orders?.length) {
    return <div className="p-4 text-center text-tg-hint py-12">Нет доступных заказов</div>
  }

  return (
    <div className="p-4 space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="rounded-xl bg-tg-secondary-bg p-4 space-y-2">
          <p className="font-medium">
            {order.category.icon_emoji} {order.category.name}
          </p>
          <p className="text-sm">{order.description}</p>
          <p className="text-sm text-tg-hint">📍 {order.address}</p>
          <p className="text-sm text-tg-hint">🕐 {new Date(order.scheduled_at).toLocaleString('ru-RU')}</p>
          <p className="text-sm text-tg-hint">Клиент: {order.client.first_name}</p>
          <button
            onClick={() => accept(order.id)}
            disabled={acceptingId === order.id}
            className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
          >
            {acceptingId === order.id ? 'Принимаем...' : 'Принять заказ'}
          </button>
        </div>
      ))}
    </div>
  )
}
