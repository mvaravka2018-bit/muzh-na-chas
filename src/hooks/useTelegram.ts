'use client'

interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface TelegramHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  selectionChanged: () => void
}

interface TelegramMainButton {
  show: () => void
  hide: () => void
  setText: (text: string) => void
  onClick: (cb: () => void) => void
  offClick: (cb: () => void) => void
  enable: () => void
  disable: () => void
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: { user?: TelegramWebAppUser }
  HapticFeedback: TelegramHapticFeedback
  MainButton: TelegramMainButton
  ready: () => void
  expand: () => void
  close: () => void
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp }
  }
}

export function useTelegram() {
  const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined

  return {
    tg,
    user: tg?.initDataUnsafe?.user,
    initData: tg?.initData,
    haptic: tg?.HapticFeedback,
    mainButton: tg?.MainButton,
    ready: () => tg?.ready(),
    expand: () => tg?.expand(),
    close: () => tg?.close(),
  }
}
