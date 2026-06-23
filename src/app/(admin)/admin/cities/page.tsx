'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'

interface City {
  id: string
  slug: string
  name: string
  commission_rate: number
  is_active: boolean
  created_at: string
}

export default function AdminCitiesPage() {
  const { accessToken, user, loading: authLoading } = useAuth()
  const [cities, setCities] = useState<City[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<{ data: City[] }>('/api/admin/cities', accessToken)
      .then((res) => setCities(res.data))
      .catch(() => setError('Не удалось загрузить города'))
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  const toggleActive = async (id: string, isActive: boolean) => {
    if (!accessToken) return
    try {
      await apiFetch(`/api/admin/cities/${id}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !isActive }),
      })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка')
    }
  }

  if (user?.role !== 'superadmin') {
    return <div className="text-center text-tg-hint py-12">Доступ запрещён</div>
  }

  if (authLoading || (!cities && !error)) {
    return <div className="text-center text-tg-hint">Загрузка...</div>
  }

  if (error) return <div className="text-center text-tg-hint">{error}</div>

  if (!cities?.length) {
    return <div className="text-center text-tg-hint py-12">Городов нет</div>
  }

  return (
    <div className="space-y-3">
      {cities.map((city) => (
        <div key={city.id} className="rounded-xl bg-tg-secondary-bg p-4 space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-medium">{city.name}</p>
            <span className={`text-xs px-2 py-1 rounded-full ${city.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              {city.is_active ? 'Активен' : 'Неактивен'}
            </span>
          </div>
          <p className="text-sm text-tg-hint">Slug: {city.slug}</p>
          <p className="text-sm text-tg-hint">Комиссия: {(city.commission_rate * 100).toFixed(0)}%</p>
          <button
            onClick={() => toggleActive(city.id, city.is_active)}
            className="text-sm text-tg-link"
          >
            {city.is_active ? 'Деактивировать' : 'Активировать'}
          </button>
        </div>
      ))}
    </div>
  )
}
