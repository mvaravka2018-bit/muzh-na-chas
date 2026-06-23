'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'

interface AdminReview {
  id: string
  rating: number
  comment: string | null
  is_visible: boolean
  created_at: string
  client: { first_name: string }
  master: { user: { first_name: string } }
}

export default function AdminReviewsPage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [reviews, setReviews] = useState<AdminReview[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<{ data: AdminReview[] }>('/api/admin/reviews', accessToken)
      .then((res) => setReviews(res.data))
      .catch(() => setError('Не удалось загрузить отзывы'))
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  const toggleVisibility = async (id: string, isVisible: boolean) => {
    if (!accessToken) return
    setPendingId(id)
    try {
      await apiFetch(`/api/admin/reviews/${id}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ is_visible: !isVisible }),
      })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка')
    } finally {
      setPendingId(null)
    }
  }

  if (authLoading || (!reviews && !error)) {
    return <div className="text-center text-tg-hint">Загрузка...</div>
  }

  if (error) return <div className="text-center text-tg-hint">{error}</div>

  if (!reviews?.length) {
    return <div className="text-center text-tg-hint py-12">Отзывов нет</div>
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <div key={review.id} className={`rounded-xl bg-tg-secondary-bg p-4 space-y-1 ${!review.is_visible ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between">
            <p className="font-medium">{'⭐'.repeat(review.rating)}</p>
            <p className="text-xs text-tg-hint">{new Date(review.created_at).toLocaleDateString('ru-RU')}</p>
          </div>
          <p className="text-sm">{review.comment ?? '—'}</p>
          <p className="text-xs text-tg-hint">
            {review.client.first_name} → {review.master.user.first_name}
          </p>
          <button
            onClick={() => toggleVisibility(review.id, review.is_visible)}
            disabled={pendingId === review.id}
            className="text-sm text-tg-link disabled:opacity-50"
          >
            {review.is_visible ? 'Скрыть' : 'Показать'}
          </button>
        </div>
      ))}
    </div>
  )
}
