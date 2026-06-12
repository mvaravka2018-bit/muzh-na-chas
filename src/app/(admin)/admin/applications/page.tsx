'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'

interface Application {
  id: string
  full_name: string
  phone: string
  experience: string
  status: string
  created_at: string
  user: { first_name: string; phone: string | null; telegram_id: number }
}

export default function AdminApplicationsPage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [applications, setApplications] = useState<Application[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<{ data: Application[] }>('/api/admin/master-applications?status=pending', accessToken)
      .then((res) => setApplications(res.data))
      .catch(() => setError('Не удалось загрузить заявки'))
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  const review = async (id: string, status: 'approved' | 'rejected') => {
    if (!accessToken) return
    setPendingId(id)
    try {
      await apiFetch(`/api/admin/master-applications/${id}`, accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось обновить заявку')
    } finally {
      setPendingId(null)
    }
  }

  if (authLoading || (!applications && !error)) {
    return <div className="text-center text-tg-hint">Загрузка...</div>
  }

  if (error) {
    return <div className="text-center text-tg-hint">{error}</div>
  }

  if (!applications?.length) {
    return <div className="text-center text-tg-hint py-12">Нет заявок на рассмотрении</div>
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => (
        <div key={app.id} className="rounded-xl bg-tg-secondary-bg p-4 space-y-2">
          <p className="font-medium">{app.full_name}</p>
          <p className="text-sm text-tg-hint">📞 {app.phone}</p>
          <p className="text-sm">{app.experience}</p>
          <p className="text-xs text-tg-hint">{new Date(app.created_at).toLocaleString('ru-RU')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => review(app.id, 'approved')}
              disabled={pendingId === app.id}
              className="flex-1 py-2 rounded-xl font-medium bg-green-600 text-white disabled:opacity-50"
            >
              Одобрить
            </button>
            <button
              onClick={() => review(app.id, 'rejected')}
              disabled={pendingId === app.id}
              className="flex-1 py-2 rounded-xl font-medium bg-red-600 text-white disabled:opacity-50"
            >
              Отклонить
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
