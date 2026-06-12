'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch } from '@/lib/api'
import { BalanceCard } from '@/components/app/BalanceCard'
import { TransactionsList } from '@/components/app/TransactionsList'
import { WithdrawForm } from '@/components/app/WithdrawForm'

interface BalanceData {
  balance: number
  total_earned: number
  commissions: { id: string; order_id: string; amount: number; rate: number; status: string; charged_at: string | null; created_at: string }[]
  withdrawals: { id: string; amount: number; status: string; created_at: string; processed_at: string | null }[]
}

export default function MasterBalancePage() {
  const { accessToken, loading: authLoading } = useAuth()
  const [data, setData] = useState<BalanceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<BalanceData>('/api/masters/me/balance', accessToken)
      .then(setData)
      .catch(() => setError('Не удалось загрузить баланс'))
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  if (authLoading || (!data && !error)) {
    return <div className="p-4 text-center text-tg-hint">Загрузка...</div>
  }

  if (error || !data) {
    return <div className="p-4 text-center text-tg-hint">{error}</div>
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-semibold">Баланс</h1>
      <BalanceCard balance={data.balance} totalEarned={data.total_earned} />
      <WithdrawForm balance={data.balance} onSuccess={load} />
      <div>
        <h2 className="font-medium mb-2">История операций</h2>
        <TransactionsList commissions={data.commissions} withdrawals={data.withdrawals} />
      </div>
    </div>
  )
}
