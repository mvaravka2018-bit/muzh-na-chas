'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'

interface Withdrawal {
  id: string
  amount: number
  status: string
  bank_details: { bank_name: string; account_number: string; recipient_name: string }
  created_at: string
  master: { user: { first_name: string; phone: string | null } }
}

export default function AdminWithdrawalsPage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [withdrawals, setWithdrawals] = useState<Withdrawal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<{ data: Withdrawal[] }>('/api/admin/withdrawals?status=pending', accessToken)
      .then((res) => setWithdrawals(res.data))
      .catch(() => setError('Не удалось загрузить заявки'))
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  const process = async (id: string, status: 'completed' | 'rejected') => {
    if (!accessToken) return
    setPendingId(id)
    try {
      await apiFetch(`/api/admin/withdrawals/${id}`, accessToken, {
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

  if (authLoading || (!withdrawals && !error)) {
    return <div className="text-center text-tg-hint">Загрузка...</div>
  }

  if (error) {
    return <div className="text-center text-tg-hint">{error}</div>
  }

  if (!withdrawals?.length) {
    return <div className="text-center text-tg-hint py-12">Нет заявок на вывод</div>
  }

  return (
    <div className="space-y-3">
      {withdrawals.map((w) => (
        <div key={w.id} className="rounded-xl bg-tg-secondary-bg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-medium">{w.master.user.first_name}</p>
            <p className="font-medium">{w.amount} ₽</p>
          </div>
          <p className="text-sm text-tg-hint">{w.bank_details.bank_name} · {w.bank_details.account_number}</p>
          <p className="text-sm text-tg-hint">{w.bank_details.recipient_name}</p>
          <p className="text-xs text-tg-hint">{new Date(w.created_at).toLocaleString('ru-RU')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => process(w.id, 'completed')}
              disabled={pendingId === w.id}
              className="flex-1 py-2 rounded-xl font-medium bg-green-600 text-white disabled:opacity-50"
            >
              Выполнено
            </button>
            <button
              onClick={() => process(w.id, 'rejected')}
              disabled={pendingId === w.id}
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
