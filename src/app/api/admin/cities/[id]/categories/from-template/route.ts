import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthContext } from '@/lib/auth'

const BodySchema = z.object({
  template_ids: z.array(z.string().uuid()).min(1),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = getAuthContext(req)
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id: cityId } = await params
  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: templates, error: templateError } = await supabase
    .from('category_templates')
    .select('*')
    .in('id', parsed.data.template_ids)

  if (templateError || !templates?.length) {
    return NextResponse.json({ error: 'templates_not_found' }, { status: 404 })
  }

  const rows = templates.map((t) => ({
    city_id: cityId,
    slug: t.slug,
    name: t.name,
    description: t.description,
    icon_emoji: t.icon_emoji,
    base_price: t.base_price,
    sort_order: t.sort_order,
  }))

  const { error: insertError } = await supabase.from('categories').insert(rows)

  if (insertError) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json({ created: rows.length }, { status: 201 })
}
