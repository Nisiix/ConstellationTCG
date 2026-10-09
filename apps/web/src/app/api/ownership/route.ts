import { ownershipSnapshot } from '@constellation/ownership'
import type { NextRequest } from 'next/server'
import { getDatabase } from '@/server/db'
import { errorResponse, json, rateLimit } from '@/server/http'
import { requireUser } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** My Constellation: the node ids to highlight and every owned asset with its resolution. */
export async function GET(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const user = await requireUser()
    const { db } = await getDatabase()
    const snapshot = await ownershipSnapshot(db, user.id)
    return json({ ...snapshot, syncedAt: new Date().toISOString() }, { cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
