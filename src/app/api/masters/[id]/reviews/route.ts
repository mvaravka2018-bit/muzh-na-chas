import { z } from 'zod'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = createAdminClient()
  const from = (parsed.data.page - 1) * parsed.data.limit
  const to = from + parsed.data.limit - 1

  const { data, count, error } = await supabase
    .from('reviews')
    .select('id, rating, comment, master_reply, created_at, client:users!reviews_client_id_fkey(first_name)', { count: 'exact' })
    .eq('master_id', id)
    .eq('is_visible', true)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  const { data: master } = await supabase.from('masters').select('rating').eq('id', id).single()

  return NextResponse.json({ data, total: count ?? 0, avg_rating: master?.rating ?? 0 })
}
