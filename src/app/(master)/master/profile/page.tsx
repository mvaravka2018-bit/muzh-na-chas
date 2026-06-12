'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/components/app/AuthProvider'
import { apiFetch, ApiError } from '@/lib/api'
import { MasterApplicationForm } from '@/components/app/MasterApplicationForm'
import { ProfileForm } from '@/components/app/ProfileForm'
import { CategorySelect } from '@/components/app/CategorySelect'
import { PortfolioUpload } from '@/components/app/PortfolioUpload'

interface MasterMe {
  bio: string | null
  experience_years: number
  is_available: boolean
  is_verified: boolean
  master_categories: { category: { id: string } }[]
  master_portfolio: { id: string; image_url: string; caption: string | null }[]
}

export default function MasterProfilePage() {
  const { accessToken, user, loading: authLoading } = useAuth()
  const [master, setMaster] = useState<MasterMe | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!accessToken) return
    apiFetch<MasterMe>('/api/masters/me', accessToken)
      .then(setMaster)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setMaster(null)
        } else {
          setError('Не удалось загрузить профиль')
        }
      })
  }, [accessToken])

  useEffect(() => {
    load()
  }, [load])

  if (authLoading || master === undefined) {
    return <div className="p-4 text-center text-tg-hint">Загрузка...</div>
  }

  if (user?.role !== 'master' || master === null) {
    return <MasterApplicationForm />
  }

  if (error) {
    return <div className="p-4 text-center text-tg-hint">{error}</div>
  }

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-lg font-semibold">Профиль мастера</h1>
      <ProfileForm
        initialBio={master.bio ?? ''}
        initialExperience={master.experience_years}
        initialAvailable={master.is_available}
      />
      <CategorySelect initialSelected={master.master_categories?.map((mc) => mc.category.id) ?? []} />
      <PortfolioUpload initialItems={master.master_portfolio ?? []} />
    </div>
  )
}
