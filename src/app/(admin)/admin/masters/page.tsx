'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch } from '@/lib/api'

interface AdminMaster {
  id: string
  bio: string | null
  is_verified: boolean
  is_available: boolean
  rating: number
  reviews_count: number
  balance: number
  user: { first_name: string; phone: string | null }
}

export default function AdminMastersPage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [masters, setMasters] = useState<AdminMaster[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    apiFetch<{ data: AdminMaster[] }>('/api/admin/masters', accessToken)
      .then((res) => setMasters(res.data))
      .catch(() => setError('Не удалось загрузить мастеров'))
  }, [accessToken])

  if (authLoading || (!masters && !error)) {
    return <div className="text-center text-tg-hint">Загрузка...</div>
  }

  if (error) return <div className="text-center text-tg-hint">{error}</div>

  if (!masters?.length) {
    return <div className="text-center text-tg-hint py-12">Мастеров нет</div>
  }

  return (
    <div className="space-y-3">
      {masters.map((master) => (
        <div key={master.id} className="rounded-xl bg-tg-secondary-bg p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-medium">{master.user.first_name}</p>
            <span className={`text-xs px-2 py-1 rounded-full ${master.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {master.is_verified ? 'Верифицирован' : 'Не верифицирован'}
            </span>
          </div>
          <p className="text-sm text-tg-hint">⭐ {master.rating} · {master.reviews_count} отзывов</p>
          <p className="text-sm text-tg-hint">Баланс: {master.balance} ₽</p>
          {master.is_available && <span className="text-xs text-green-600">Онлайн</span>}
        </div>
      ))}
    </div>
  )
}
