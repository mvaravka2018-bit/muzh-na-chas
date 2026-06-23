import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  is_available: z.boolean(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: master, error: masterError } = await supabase
    .from('masters')
    .select('id, user_id')
    .eq('id', id)
    .single()

  if (masterError || !master) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (master.user_id !== auth.userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { data: updated, error } = await supabase
    .from('masters')
    .update({ is_available: parsed.data.is_available })
    .eq('id', id)
    .select('is_available')
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
