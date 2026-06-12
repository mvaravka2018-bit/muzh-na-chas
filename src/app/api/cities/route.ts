import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cities')
    .select('id, slug, name, bot_username, timezone')
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }

  return NextResponse.json(data)
}
