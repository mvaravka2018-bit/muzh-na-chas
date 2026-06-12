'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'
import { getDefaultCitySlug } from '@/lib/city'
import type { Category } from '@/types'

const FormSchema = z.object({
  full_name: z.string().min(2, 'Введите имя и фамилию'),
  phone: z.string().min(5, 'Введите номер телефона'),
  experience: z.string().min(1, 'Расскажите о своём опыте'),
})

type FormValues = z.infer<typeof FormSchema>

interface ApplicationStatus {
  status: 'pending' | 'approved' | 'rejected'
}

export function MasterApplicationForm() {
  const { accessToken } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [status, setStatus] = useState<ApplicationStatus | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(FormSchema) })

  useEffect(() => {
    fetch(`/api/cities/${getDefaultCitySlug()}/categories`)
      .then((res) => res.json())
      .then(setCategories)
      .catch(() => setCategories([]))

    if (!accessToken) return
    apiFetch<ApplicationStatus | null>('/api/master-applications', accessToken)
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [accessToken])

  const toggleCategory = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
  }

  const onSubmit = async (values: FormValues) => {
    if (!accessToken) return
    if (selected.length === 0) {
      setError('Выберите хотя бы одну категорию услуг')
      return
    }
    setError(null)
    try {
      await apiFetch('/api/master-applications', accessToken, {
        method: 'POST',
        body: JSON.stringify({ ...values, category_ids: selected }),
      })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось отправить заявку')
    }
  }

  if (status === undefined) {
    return <div className="p-4 text-center text-tg-hint">Загрузка...</div>
  }

  if (status?.status === 'pending') {
    return (
      <div className="p-4 text-center text-tg-hint py-12">
        Ваша заявка на рассмотрении. Мы сообщим о результате.
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="p-4 text-center text-tg-hint py-12">
        Заявка отправлена! Мы рассмотрим её в ближайшее время.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">Стать мастером</h1>

      <div>
        <label className="block text-sm font-medium mb-1">Имя и фамилия</label>
        <input
          {...register('full_name')}
          className="w-full p-3 rounded-xl bg-tg-secondary-bg border border-tg-hint/20"
        />
        {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Телефон</label>
        <input
          {...register('phone')}
          className="w-full p-3 rounded-xl bg-tg-secondary-bg border border-tg-hint/20"
        />
        {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Опыт работы</label>
        <textarea
          {...register('experience')}
          rows={4}
          className="w-full p-3 rounded-xl bg-tg-secondary-bg border border-tg-hint/20"
        />
        {errors.experience && <p className="text-red-500 text-sm mt-1">{errors.experience.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Категории услуг</label>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => toggleCategory(category.id)}
              className={`p-3 rounded-xl border text-sm text-left ${
                selected.includes(category.id)
                  ? 'border-tg-link bg-tg-link/10'
                  : 'border-tg-hint/20 bg-tg-secondary-bg'
              }`}
            >
              {category.icon_emoji} {category.name}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
      >
        Отправить заявку
      </button>
    </form>
  )
}
