'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'
import { StatusBadge } from '@/components/app/StatusBadge'
import { StatusTimeline } from '@/components/app/StatusTimeline'
import type { Order, OrderStatus } from '@/types'

interface OrderDetail extends Order {
  category: { name: string; icon_emoji: string }
  master: { id: string; user: { first_name: string; phone: string | null } } | null
  photos: { id: string; image_url: string }[]
  status_history: { status: OrderStatus; note: string | null; created_at: string }[]
}

export default function ClientOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken, loading: authLoading } = useAuth()
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<OrderDetail>(`/api/orders/${id}`, accessToken)
      .then(setOrder)
      .catch(() => setError('Не удалось загрузить заказ'))
  }, [accessToken, id])

  useEffect(() => {
    load()
  }, [load])

  const updateStatus = async (status: OrderStatus) => {
    if (!accessToken) return
    setPending(true)
    setActionError(null)
    try {
      await apiFetch(`/api/orders/${id}/status`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      if (status === 'confirmed') {
        router.push(`/orders/${id}/review`)
      } else {
        load()
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не удалось обновить статус')
    } finally {
      setPending(false)
    }
  }

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
        {order.master && (
          <p className="text-tg-hint">
            👷 {order.master.user.first_name} {order.master.user.phone ? `· ${order.master.user.phone}` : ''}
          </p>
        )}
        {order.total_amount && <p className="font-medium">Сумма: {order.total_amount} ₽</p>}
      </div>

      {order.status === 'completed' && (
        <div className="space-y-2">
          <button
            onClick={() => updateStatus('confirmed')}
            disabled={pending}
            className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
          >
            Подтвердить выполнение
          </button>
          <button
            onClick={() => updateStatus('disputed')}
            disabled={pending}
            className="w-full py-3 rounded-xl font-medium bg-red-100 text-red-800 disabled:opacity-50"
          >
            Открыть спор
          </button>
        </div>
      )}

      {(order.status === 'pending' || order.status === 'accepted') && (
        <button
          onClick={() => updateStatus('cancelled')}
          disabled={pending}
          className="w-full py-3 rounded-xl font-medium bg-red-100 text-red-800 disabled:opacity-50"
        >
          Отменить заказ
        </button>
      )}

      {actionError && <p className="text-red-500 text-sm">{actionError}</p>}

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
