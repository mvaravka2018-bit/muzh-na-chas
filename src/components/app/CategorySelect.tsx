'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'
import { getDefaultCitySlug } from '@/lib/city'
import type { Category } from '@/types'

export function CategorySelect({ initialSelected }: { initialSelected: string[] }) {
  const { accessToken } = useAuth()
  const [categories, setCategories] = useState<Category[]>([])
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch(`/api/cities/${getDefaultCitySlug()}/categories`)
      .then((res) => res.json())
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))
    setSaved(false)
  }

  const save = async () => {
    if (!accessToken) return
    if (selected.length === 0) {
      setError('Выберите хотя бы одну категорию')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiFetch('/api/masters/me/categories', accessToken, {
        method: 'PUT',
        body: JSON.stringify({ category_ids: selected }),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="font-medium">Категории услуг</h2>
      <div className="grid grid-cols-2 gap-2">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => toggle(category.id)}
            className={`p-3 rounded-xl border text-sm text-left ${
              selected.includes(category.id) ? 'border-tg-link bg-tg-link/10' : 'border-tg-hint/20 bg-tg-secondary-bg'
            }`}
          >
            {category.icon_emoji} {category.name}
          </button>
        ))}
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm">Сохранено</p>}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
      >
        Сохранить категории
      </button>
    </div>
  )
}
