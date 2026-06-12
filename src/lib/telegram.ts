import { createHmac } from 'crypto'

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface ValidationResult {
  ok: boolean
  user?: TelegramUser
  error?: 'invalid_init_data' | 'init_data_expired'
}

const MAX_AUTH_AGE_SECONDS = 3600

export function validateTelegramInitData(initData: string, botToken: string): ValidationResult {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return { ok: false, error: 'invalid_init_data' }

  params.delete('hash')
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expectedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (hash !== expectedHash) return { ok: false, error: 'invalid_init_data' }

  const authDate = Number(params.get('auth_date'))
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) {
    return { ok: false, error: 'init_data_expired' }
  }

  const userRaw = params.get('user')
  if (!userRaw) return { ok: false, error: 'invalid_init_data' }

  let user: TelegramUser
  try {
    user = JSON.parse(userRaw)
  } catch {
    return { ok: false, error: 'invalid_init_data' }
  }

  return { ok: true, user }
}
