'use client'

import { useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'

const MIN_AMOUNT = 500

export function WithdrawForm({ balance, onSuccess }: { balance: number; onSuccess: () => void }) {
  const { accessToken } = useAuth()
  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const submit = async () => {
    if (!accessToken) return
    setError(null)
    const numAmount = Number(amount)
    if (numAmount < MIN_AMOUNT) {
      setError(`Минимальная сумма вывода — ${MIN_AMOUNT} ₽`)
      return
    }
    if (numAmount > balance) {
      setError('Недостаточно средств на балансе')
      return
    }
    if (!bankName || !accountNumber || !recipientName) {
      setError('Заполните реквизиты для перевода')
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/api/withdrawals', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          amount: numAmount,
          bank_details: { bank_name: bankName, account_number: accountNumber, recipient_name: recipientName },
        }),
      })
      setSuccess(true)
      setAmount('')
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить заявку')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="font-medium">Вывести средства</h2>
      <input
        type="number"
        placeholder={`Сумма, мин. ${MIN_AMOUNT} ₽`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full p-3 rounded-xl bg-tg-secondary-bg border border-tg-hint/20"
      />
      <input
        placeholder="Банк"
        value={bankName}
        onChange={(e) => setBankName(e.target.value)}
        className="w-full p-3 rounded-xl bg-tg-secondary-bg border border-tg-hint/20"
      />
      <input
        placeholder="Номер счёта / карты"
        value={accountNumber}
        onChange={(e) => setAccountNumber(e.target.value)}
        className="w-full p-3 rounded-xl bg-tg-secondary-bg border border-tg-hint/20"
      />
      <input
        placeholder="ФИО получателя"
        value={recipientName}
        onChange={(e) => setRecipientName(e.target.value)}
        className="w-full p-3 rounded-xl bg-tg-secondary-bg border border-tg-hint/20"
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">Заявка отправлена</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
      >
        Отправить заявку
      </button>
    </div>
  )
}
