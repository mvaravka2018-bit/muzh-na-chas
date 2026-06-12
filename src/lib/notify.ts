type NotifyEvent =
  | 'order_new'
  | 'order_accepted'
  | 'order_in_progress'
  | 'order_completed'
  | 'order_confirmed'
  | 'order_cancelled'
  | 'commission_charged'
  | 'master_verified'
  | 'withdrawal_processed'

interface NotifyPayload {
  event: NotifyEvent
  order_id?: string
  user_id?: string
  extra?: Record<string, unknown>
}

export async function notify(payload: NotifyPayload): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const secret = process.env.INTERNAL_API_SECRET
  if (!appUrl || !secret) return

  try {
    await fetch(`${appUrl}/api/internal/notify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-secret': secret,
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    console.error('notify_failed', error)
  }
}
