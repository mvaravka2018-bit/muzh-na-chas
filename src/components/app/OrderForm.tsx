'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/app/AuthProvider'
import { useTelegram } from '@/hooks/useTelegram'
import { apiFetch, ApiError } from '@/lib/api'

const schema = z.object({
  description: z.string().min(10, 'Минимум 10 символов'),
  address: z.string().min(5, 'Укажите адрес'),
  scheduled_at: z.string().min(1, 'Укажите дату и время'),
  payment_type: z.enum(['cash', 'online']),
  client_note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function OrderForm({ categoryId }: { categoryId: string }) {
  const { accessToken } = useAuth()
  const { haptic } = useTelegram()
  const router = useRouter()
  const searchParams = useSearchParams()
  const masterId = searchParams.get('master') ?? undefined

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { payment_type: 'cash' },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      const order = await apiFetch<{ id: string }>('/api/orders', accessToken, {
        method: 'POST',
        body: JSON.stringify({
          category_id: categoryId,
          description: values.description,
          address: values.address,
          scheduled_at: new Date(values.scheduled_at).toISOString(),
          payment_type: values.payment_type,
          client_note: values.client_note || undefined,
          master_id: masterId,
        }),
      })
      haptic?.notificationOccurred('success')
      router.push(`/orders/${order.id}`)
    } catch (err) {
      if (err instanceof ApiError) {
        setError('root', { message: err.message })
      } else {
        setError('root', { message: 'Не удалось создать заказ' })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-4">
      <div>
        <label className="block text-sm mb-1">Описание задачи</label>
        <textarea
          {...register('description')}
          rows={4}
          className="w-full p-3 rounded-xl bg-tg-secondary-bg"
          placeholder="Опишите, что нужно сделать"
        />
        {errors.description && <p className="text-red-500 text-sm">{errors.description.message}</p>}
      </div>

      <div>
        <label className="block text-sm mb-1">Адрес</label>
        <input {...register('address')} className="w-full p-3 rounded-xl bg-tg-secondary-bg" />
        {errors.address && <p className="text-red-500 text-sm">{errors.address.message}</p>}
      </div>

      <div>
        <label className="block text-sm mb-1">Дата и время</label>
        <input type="datetime-local" {...register('scheduled_at')} className="w-full p-3 rounded-xl bg-tg-secondary-bg" />
        {errors.scheduled_at && <p className="text-red-500 text-sm">{errors.scheduled_at.message}</p>}
      </div>

      <div>
        <label className="block text-sm mb-1">Способ оплаты</label>
        <select {...register('payment_type')} className="w-full p-3 rounded-xl bg-tg-secondary-bg">
          <option value="cash">Наличными мастеру</option>
          <option value="online">Онлайн</option>
        </select>
      </div>

      <div>
        <label className="block text-sm mb-1">Комментарий (необязательно)</label>
        <textarea {...register('client_note')} rows={2} className="w-full p-3 rounded-xl bg-tg-secondary-bg" />
      </div>

      {errors.root && <p className="text-red-500 text-sm">{errors.root.message}</p>}

      <button
        type="submit"
        disabled={isSubmitting || !accessToken}
        className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
      >
        {isSubmitting ? 'Отправка...' : 'Создать заказ'}
      </button>
    </form>
  )
}
