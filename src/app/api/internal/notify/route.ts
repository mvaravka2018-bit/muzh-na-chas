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

function buildMessage(event: string, extra: Record<string, unknown>): string {
  switch (event) {
    case 'order_new':
      return `🔔 Новый заказ!\n📋 ${extra.category ?? ''}\n📍 ${extra.address ?? ''}\n🕐 ${extra.scheduled_at ?? ''}\n\n${extra.description ?? ''}`
    case 'order_accepted':
      return `✅ Мастер ${extra.master_name ?? ''} принял ваш заказ${extra.master_phone ? `\n📞 ${extra.master_phone}` : ''}`
    case 'order_in_progress':
      return '🔧 Мастер приступил к выполнению заказа'
    case 'order_completed':
      return `🏁 Мастер завершил работу.\nСумма: ${extra.total_amount ?? '—'} ₽\n\nПодтвердите выполнение или откройте спор.`
    case 'order_confirmed':
      return '⭐ Заказ подтверждён клиентом'
    case 'order_cancelled':
      return `❌ Заказ отменён${extra.reason ? `\nПричина: ${extra.reason}` : ''}`
    case 'commission_charged':
      return `💳 Комиссия ${extra.amount ?? ''} ₽ списана за заказ #${extra.short_id ?? ''}`
    case 'master_verified':
      return '🎉 Ваш профиль верифицирован! Теперь вы можете принимать заказы.'
    case 'withdrawal_processed':
      return extra.status === 'completed'
        ? `💸 Заявка на вывод ${extra.amount ?? ''} ₽ выполнена`
        : `⚠️ Заявка на вывод ${extra.amount ?? ''} ₽ отклонена`
    default:
      return event
  }
}

const MAX_RETRIES = 3

async function sendTelegramMessage(bot: Bot, chatId: number | string, text: string): Promise<boolean> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await bot.api.sendMessage(chatId, text)
      return true
    } catch (error: unknown) {
      const err = error as { error_code?: number }
      if (err.error_code === 429) {
        const delay = [1000, 3000, 9000][attempt] ?? 9000
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
      if (err.error_code === 403) {
        return false
      }
      console.error('telegram_send_failed', error)
      return false
    }
  }
  return false
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
      .select('id, client_id, city_id, category_id, description, address, scheduled_at, master:masters(user_id)')
      .eq('id', order_id)
      .single()

    if (order) {
      const masterUserId = (order.master as unknown as { user_id: string } | null)?.user_id

      switch (event) {
        case 'order_new':
          if (user_id) {
            recipients.push({ userId: user_id })
          } else {
            const { data: availableMasters } = await supabase
              .from('master_categories')
              .select('master:masters!inner(user_id, city_id, is_verified, is_available)')
              .eq('category_id', order.category_id)

            if (availableMasters) {
              for (const mc of availableMasters) {
                const m = mc.master as unknown as { user_id: string; city_id: string; is_verified: boolean; is_available: boolean }
                if (m && m.city_id === order.city_id && m.is_verified && m.is_available) {
                  recipients.push({ userId: m.user_id })
                }
              }
            }
          }
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

    const text = buildMessage(event, extra ?? {})

    let telegramOk = false
    if (city?.bot_token) {
      const bot = new Bot(city.bot_token)
      telegramOk = await sendTelegramMessage(bot, user.telegram_id, text)
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
