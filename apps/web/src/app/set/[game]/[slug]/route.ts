import type { NextRequest } from 'next/server'
import { getDatabase } from '@/server/db'
import { errorResponse, rateLimit } from '@/server/http'
import { resolveSetSlug } from '@/server/pretty'
import { redirectToExplorer } from '../../../card/[game]/[slug]/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** `/set/pokemon/base-set` (or `/set/pokemon/base1`) → the explorer on that set. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ game: string; slug: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const { game, slug } = await context.params
    const { db } = await getDatabase()
    const nodeId = await resolveSetSlug(db, decodeURIComponent(game), decodeURIComponent(slug))
    return redirectToExplorer(request, decodeURIComponent(game), nodeId, slug)
  } catch (error) {
    return errorResponse(error)
  }
}
