'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useTelegram } from '@/hooks/useTelegram'
import { getDefaultCitySlug } from '@/lib/city'

interface AuthUser {
  id: string
  role: string
  city_id: string
}

interface AuthContextValue {
  accessToken: string | null
  user: AuthUser | null
  loading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextValue>({
  accessToken: null,
  user: null,
  loading: true,
  error: null,
})

const STORAGE_KEY = 'mnc_auth_tokens'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initData, ready } = useTelegram()
  const [state, setState] = useState<AuthContextValue>({
    accessToken: null,
    user: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    ready()

    if (!initData) {
      const timer = setTimeout(() => {
        setState({ accessToken: null, user: null, loading: false, error: 'no_init_data' })
      }, 0)
      return () => clearTimeout(timer)
    }

    const authenticate = async () => {
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ initData, city_slug: getDefaultCitySlug() }),
        })
        const data = await res.json()
        if (!res.ok) {
          setState({ accessToken: null, user: null, loading: false, error: data.error ?? 'auth_failed' })
          return
        }
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
        setState({ accessToken: data.access_token, user: data.user, loading: false, error: null })
      } catch {
        setState({ accessToken: null, user: null, loading: false, error: 'network_error' })
      }
    }

    authenticate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
