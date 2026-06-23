'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
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

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return Date.now() / 1000 > (payload.exp ?? 0) - 60
  } catch {
    return true
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initData, ready } = useTelegram()
  const [state, setState] = useState<AuthContextValue>({
    accessToken: null,
    user: null,
    loading: true,
    error: null,
  })
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    ready()

    const stored = typeof window !== 'undefined' ? sessionStorage.getItem(STORAGE_KEY) : null
    if (stored) {
      try {
        const { access_token, refresh_token, user } = JSON.parse(stored)
        if (access_token && !isTokenExpired(access_token)) {
          setState({ accessToken: access_token, user, loading: false, error: null })
          scheduleRefresh(access_token, refresh_token)
          return
        }
        if (refresh_token) {
          refreshTokens(refresh_token)
          return
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY)
      }
    }

    if (!initData) {
      setState({ accessToken: null, user: null, loading: false, error: 'no_init_data' })
      return
    }

    authenticate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData])

  async function authenticate() {
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
      scheduleRefresh(data.access_token, data.refresh_token)
    } catch {
      setState({ accessToken: null, user: null, loading: false, error: 'network_error' })
    }
  }

  async function refreshTokens(refreshToken: string) {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      const data = await res.json()
      if (!res.ok) {
        sessionStorage.removeItem(STORAGE_KEY)
        if (initData) {
          authenticate()
        } else {
          setState({ accessToken: null, user: null, loading: false, error: 'session_expired' })
        }
        return
      }
      const stored = sessionStorage.getItem(STORAGE_KEY)
      const prev = stored ? JSON.parse(stored) : {}
      const updated = { ...prev, access_token: data.access_token, refresh_token: data.refresh_token }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      setState((s) => ({ ...s, accessToken: data.access_token, loading: false }))
      scheduleRefresh(data.access_token, data.refresh_token)
    } catch {
      setState({ accessToken: null, user: null, loading: false, error: 'network_error' })
    }
  }

  function scheduleRefresh(accessToken: string, refreshToken: string) {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      const expiresIn = (payload.exp ?? 0) - Date.now() / 1000
      const refreshIn = Math.max((expiresIn - 300) * 1000, 10000)
      refreshTimerRef.current = setTimeout(() => refreshTokens(refreshToken), refreshIn)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
