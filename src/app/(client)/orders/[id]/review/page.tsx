'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>()
  const { accessToken } = useAuth()
  const router = useRouter()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!accessToken) return
    setSubmitting(true)
    setError(null)
    try {
      await apiFetch('/api/reviews', accessToken, {
        method: 'POST',
        body: JSON.stringify({ order_id: id, rating, comment: comment || undefined }),
      })
      router.push(`/orders/${id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить отзыв')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">Оставить отзыв</h1>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" onClick={() => setRating(value)} className="p-1 min-h-[44px] min-w-[44px]">
            <Star className={cn('w-8 h-8', value <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-tg-hint')} />
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        placeholder="Комментарий (необязательно)"
        className="w-full p-3 rounded-xl bg-tg-secondary-bg"
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
      >
        {submitting ? 'Отправка...' : 'Отправить отзыв'}
      </button>
    </div>
  )
}
