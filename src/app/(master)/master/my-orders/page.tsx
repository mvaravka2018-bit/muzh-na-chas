'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'
import { StatusBadge } from '@/components/app/StatusBadge'
import type { Order } from '@/types'

interface MasterOrder extends Order {
  category: { name: string; icon_emoji: string }
}

export default function MasterOrdersPage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<MasterOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<{ data: MasterOrder[] }>('/api/orders?role=master', accessToken)
      .then((res) => setOrders(res.data))
      .catch(() => setError('Не удалось загрузить заказы'))
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (id: string, status: string, totalAmount?: string) => {
    if (!accessToken) return
    setPendingId(id)
    try {
      await apiFetch(`/api/orders/${id}/status`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ status, total_amount: totalAmount ? Number(totalAmount) : undefined }),
      })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось обновить заказ')
    } finally {
      setPendingId(null)
    }
  }

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
        <div key={order.id} className="rounded-xl bg-tg-secondary-bg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Link href={`/master/orders/${order.id}`} className="font-medium">
              {order.category.icon_emoji} {order.category.name}
            </Link>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-sm text-tg-hint truncate">{order.address}</p>
          <p className="text-sm text-tg-hint">{new Date(order.scheduled_at).toLocaleString('ru-RU')}</p>

          {order.status === 'accepted' && (
            <button
              onClick={() => updateStatus(order.id, 'in_progress')}
              disabled={pendingId === order.id}
              className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
            >
              Я приступил
            </button>
          )}

          {order.status === 'in_progress' && (
            <div className="space-y-2">
              <input
                type="number"
                placeholder="Итоговая сумма, ₽"
                value={amounts[order.id] ?? ''}
                onChange={(e) => setAmounts((prev) => ({ ...prev, [order.id]: e.target.value }))}
                className="w-full p-3 rounded-xl bg-tg-bg border border-tg-hint/20"
              />
              <button
                onClick={() => updateStatus(order.id, 'completed', amounts[order.id])}
                disabled={pendingId === order.id || !amounts[order.id]}
                className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
              >
                Завершить заказ
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
