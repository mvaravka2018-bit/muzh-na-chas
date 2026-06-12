'use client'

import { useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'

interface ProfileFormProps {
  initialBio: string
  initialExperience: number
  initialAvailable: boolean
}

export function ProfileForm({ initialBio, initialExperience, initialAvailable }: ProfileFormProps) {
  const { accessToken } = useAuth()
  const [bio, setBio] = useState(initialBio)
  const [experience, setExperience] = useState(String(initialExperience))
  const [isAvailable, setIsAvailable] = useState(initialAvailable)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    if (!accessToken) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await apiFetch('/api/masters/me', accessToken, {
        method: 'PATCH',
        body: JSON.stringify({ bio, experience_years: Number(experience), is_available: isAvailable }),
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl bg-tg-secondary-bg p-4">
        <span className="font-medium">Готов принимать заказы</span>
        <button
          onClick={() => setIsAvailable((prev) => !prev)}
          className={`w-12 h-7 rounded-full transition-colors relative ${isAvailable ? 'bg-tg-button' : 'bg-tg-hint/30'}`}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
              isAvailable ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">О себе</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full p-3 rounded-xl bg-tg-secondary-bg border border-tg-hint/20"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Опыт работы, лет</label>
        <input
          type="number"
          min={0}
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          className="w-full p-3 rounded-xl bg-tg-secondary-bg border border-tg-hint/20"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm">Сохранено</p>}

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-xl font-medium bg-tg-button text-tg-button-text disabled:opacity-50"
      >
        Сохранить
      </button>
    </div>
  )
}
