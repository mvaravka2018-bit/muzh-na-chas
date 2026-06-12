import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'
import { notify } from '@/lib/notify'

const BodySchema = z.object({
  status: z.enum(['approved', 'rejected']),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'city_admin' && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: application, error: applicationError } = await supabase
    .from('master_applications')
    .select('*')
    .eq('id', id)
    .single()

  if (applicationError || !application) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (auth.role === 'city_admin' && application.city_id !== auth.cityId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (application.status !== 'pending') {
    return NextResponse.json({ error: 'already_processed' }, { status: 400 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('master_applications')
    .update({ status: parsed.data.status, reviewed_by: auth.userId, reviewed_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  if (parsed.data.status === 'approved') {
    const { data: master, error: masterError } = await supabase
      .from('masters')
      .insert({
        user_id: application.user_id,
        city_id: application.city_id,
        bio: application.experience,
        is_verified: true,
        verified_at: new Date().toISOString(),
        verified_by: auth.userId,
      })
      .select('id')
      .single()

    if (masterError || !master) {
      return NextResponse.json({ error: 'internal_error' }, { status: 500 })
    }

    await supabase.from('users').update({ role: 'master' }).eq('id', application.user_id)

    const categoryRows = (application.category_ids as string[]).map((categoryId) => ({
      master_id: master.id,
      category_id: categoryId,
    }))

    if (categoryRows.length) {
      await supabase.from('master_categories').insert(categoryRows)
    }

    await notify({ event: 'master_verified', user_id: application.user_id })
  }

  return NextResponse.json(updated)
}
