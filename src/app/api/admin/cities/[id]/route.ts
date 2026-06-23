import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  is_active: z.boolean().optional(),
  commission_rate: z.coerce.number().min(0).max(1).optional(),
  bot_token: z.string().min(10).optional(),
  name: z.string().min(1).max(200).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  if (parsed.data.is_active === false) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('city_id', id)
      .in('status', ['pending', 'accepted', 'in_progress'])

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: 'city_has_active_orders' }, { status: 400 })
    }
  }

  const { data: updated, error } = await supabase
    .from('cities')
    .update(parsed.data)
    .eq('id', id)
    .select('id')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json({ id: updated.id, updated_at: new Date().toISOString() })
}
