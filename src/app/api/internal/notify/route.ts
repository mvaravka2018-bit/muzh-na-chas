import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { Bot } from 'grammy'
import { createAdminClient } from '@/lib/supabase/admin'

const BodySchema = z.object({
  event: z.enum([
    'order_new',
    'order_accepted',
    'order_in_progress',
    'order_completed',
    'order_confirmed',
    'order_cancelled',
    'commission_charged',
    'master_verified',
    'withdrawal_processed',
  ]),
  order_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  extra: z.record(z.string(), z.unknown()).optional(),
})

const MESSAGES: Record<string, (extra: Record<string, unknown>) => string> = {
  order_new: () => '🔔 Новый заказ доступен в вашем городе',
  order_accepted: () => '✅ Мастер принял ваш заказ',
  order_in_progress: () => '🔧 Мастер приступил к выполнению заказа',
  order_completed: (extra) => `🏁 Заказ выполнен. Сумма к оплате: ${extra.total_amount ?? ''} ₽`,
  order_confirmed: () => '⭐ Заказ подтверждён клиентом',
  order_cancelled: () => '❌ Заказ отменён',
  commission_charged: (extra) => `💰 Списана комиссия: ${extra.amount ?? ''} ₽`,
  master_verified: () => '🎉 Ваша анкета мастера одобрена! Теперь вы можете принимать заказы',
  withdrawal_processed: (extra) =>
    extra.status === 'completed'
      ? `💸 Заявка на вывод ${extra.amount ?? ''} ₽ выполнена`
      : `⚠️ Заявка на вывод ${extra.amount ?? ''} ₽ отклонена`,
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret')
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { event, order_id, user_id, extra } = parsed.data
  const supabase = createAdminClient()

  const recipients: { userId: string }[] = []

  if (order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select('id, client_id, master:masters(user_id)')
      .eq('id', order_id)
      .single()

    if (order) {
      const masterUserId = (order.master as unknown as { user_id: string } | null)?.user_id

      switch (event) {
        case 'order_new':
          if (user_id) recipients.push({ userId: user_id })
          break
        case 'order_accepted':
        case 'order_in_progress':
        case 'order_completed':
          recipients.push({ userId: order.client_id })
          break
        case 'order_confirmed':
        case 'commission_charged':
          if (masterUserId) recipients.push({ userId: masterUserId })
          break
        case 'order_cancelled':
          recipients.push({ userId: order.client_id })
          if (masterUserId) recipients.push({ userId: masterUserId })
          break
      }
    }
  } else if (user_id) {
    recipients.push({ userId: user_id })
  }

  const results: Record<string, boolean> = {}

  for (const recipient of recipients) {
    const { data: user } = await supabase
      .from('users')
      .select('id, telegram_id, city_id')
      .eq('id', recipient.userId)
      .single()

    if (!user) continue

    const { data: city } = await supabase
      .from('cities')
      .select('bot_token')
      .eq('id', user.city_id)
      .single()

    const text = MESSAGES[event]?.(extra ?? {}) ?? event

    let telegramOk = false
    if (city?.bot_token) {
      try {
        const bot = new Bot(city.bot_token)
        await bot.api.sendMessage(user.telegram_id, text)
        telegramOk = true
      } catch (error) {
        console.error('telegram_send_failed', error)
      }
    }

    await supabase.from('notification_log').insert({
      user_id: user.id,
      type: event,
      payload: { order_id, extra: extra ?? {} },
      telegram_ok: telegramOk,
    })

    results[user.id] = telegramOk
  }

  return NextResponse.json({ ok: true, results })
}
