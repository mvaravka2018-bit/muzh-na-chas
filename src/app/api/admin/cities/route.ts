import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug_invalid').min(2).max(50),
  name: z.string().min(1).max(200),
  bot_token: z.string().min(10),
  bot_username: z.string().min(3).max(100),
  timezone: z.string().default('Europe/Moscow'),
  commission_rate: z.coerce.number().min(0).max(1).default(0.05),
})

export async function POST(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('cities')
    .select('id')
    .eq('slug', parsed.data.slug)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'slug_taken' }, { status: 400 })
  }

  const { data: city, error } = await supabase
    .from('cities')
    .insert(parsed.data)
    .select('id, slug')
    .single()

  if (error || !city) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(city, { status: 201 })
}

export async function GET(req: NextRequest) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const supabase = createAdminClient()
  const { data, error } = await supabase.from('cities').select('*').order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'internal_error' }, { status: 500 })

  return NextResponse.json({ data })
}
