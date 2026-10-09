import type { NextRequest } from 'next/server'
import { errorResponse, json, rateLimit } from '@/server/http'
import { getProviderRegistry } from '@/server/ownership'
import { currentUser, supabaseConfig } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Who is signed in (if anyone), whether accounts work here, and which providers are available. */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const configured = supabaseConfig() !== null
    const user = configured ? await currentUser() : null
    return json(
      { configured, user, providers: getProviderRegistry().list() },
      { cache: 'no-store' },
    )
  } catch (error) {
    return errorResponse(error)
  }
}
