import type { NextRequest } from 'next/server'
import { errorResponse, json, rateLimit } from '@/server/http'
import { requireSupabase } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const supabase = await requireSupabase()
    await supabase.auth.signOut()
    return json({ ok: true }, { cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
