import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  master_reply: z.string().min(1).max(500, 'reply_too_long'),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'master') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: master } = await supabase
    .from('masters')
    .select('id')
    .eq('user_id', auth.userId)
    .single()

  if (!master) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: review, error: reviewError } = await supabase
    .from('reviews')
    .select('id, master_id')
    .eq('id', id)
    .single()

  if (reviewError || !review) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (review.master_id !== master.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: updated, error } = await supabase
    .from('reviews')
    .update({ master_reply: parsed.data.master_reply, replied_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, master_reply, replied_at')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
