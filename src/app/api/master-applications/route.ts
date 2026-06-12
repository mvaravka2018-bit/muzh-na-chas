import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  full_name: z.string().min(2).max(200),
  phone: z.string().min(5).max(30),
  experience: z.string().min(1).max(1000),
  category_ids: z.array(z.string().uuid()).min(1),
})

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('master_applications')
    .select('id')
    .eq('user_id', auth.userId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'application_already_pending' }, { status: 400 })
  }

  const { data: application, error } = await supabase
    .from('master_applications')
    .insert({
      user_id: auth.userId,
      city_id: auth.cityId,
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      experience: parsed.data.experience,
      category_ids: parsed.data.category_ids,
      status: 'pending',
    })
    .select('*')
    .single()

  if (error || !application) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(application, { status: 201 })
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('master_applications')
    .select('*')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })

  return NextResponse.json(data)
}
