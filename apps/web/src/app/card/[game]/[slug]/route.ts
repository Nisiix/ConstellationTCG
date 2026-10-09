import { NextResponse, type NextRequest } from 'next/server'
import { buildExploreUrl, parseExploreParams } from '@/lib/url'
import { getDatabase } from '@/server/db'
import { errorResponse, rateLimit } from '@/server/http'
import { resolveCardSlug } from '@/server/pretty'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** `/card/pokemon/charizard-base-set-4` (or `/card/pokemon/base1-4`) → the explorer on that printing. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ game: string; slug: string }> },
) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const { game, slug } = await context.params
    const { db } = await getDatabase()
    const nodeId = await resolveCardSlug(db, decodeURIComponent(game), decodeURIComponent(slug))
    return redirectToExplorer(request, decodeURIComponent(game), nodeId, slug)
  } catch (error) {
    return errorResponse(error)
  }
}

/** The explorer with the resolved point and whatever depth, view and filters the link carried. */
export function redirectToExplorer(
  request: NextRequest,
  game: string,
  nodeId: string | null,
  slug: string,
): NextResponse {
  const params = parseExploreParams(request.nextUrl.searchParams)
  const target = new URL(buildExploreUrl({ ...params, game, node: nodeId }), request.url)
  if (!nodeId) target.searchParams.set('missing', slug)
  return NextResponse.redirect(target, 302)
}
