'use client'

import { useRef, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'

interface PortfolioItem {
  id: string
  image_url: string
  caption: string | null
}

export function PortfolioUpload({ initialItems }: { initialItems: PortfolioItem[] }) {
  const { accessToken } = useAuth()
  const [items, setItems] = useState(initialItems)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = async (file: File) => {
    if (!accessToken) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const item = await apiFetch<PortfolioItem>('/api/masters/me/portfolio', accessToken, {
        method: 'POST',
        body: formData,
      })
      setItems((prev) => [...prev, item])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось загрузить фото')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const remove = async (id: string) => {
    if (!accessToken) return
    try {
      await apiFetch(`/api/masters/me/portfolio/${id}`, accessToken, { method: 'DELETE' })
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось удалить')
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="font-medium">Портфолио</h2>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.id} className="relative aspect-square">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image_url} alt="" className="w-full h-full object-cover rounded-lg" />
            <button
              onClick={() => remove(item.id)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading || items.length >= 10}
          className="aspect-square rounded-lg border-2 border-dashed border-tg-hint/30 flex items-center justify-center text-tg-hint disabled:opacity-50"
        >
          {uploading ? '...' : '+'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) upload(file)
        }}
      />
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  )
}
