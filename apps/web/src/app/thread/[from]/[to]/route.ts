import { NextResponse, type NextRequest } from 'next/server'
import { parseNodeId } from '@constellation/domain'
import { buildExploreUrl } from '@/lib/url'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * `/thread/<a>/<b>`: the shareable address of a path. It carries only the two ends (and the list
 * view when that was open); the path itself is recomputed every time the link is opened.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ from: string; to: string }> }) {
  const { from: rawFrom, to: rawTo } = await context.params
  const from = decodeURIComponent(rawFrom)
  const to = decodeURIComponent(rawTo)
  const view = request.nextUrl.searchParams.get('view') === 'list' ? 'list' : null
  if (!parseNodeId(from) || !parseNodeId(to)) {
    const target = new URL(buildExploreUrl({ view }), request.url)
    target.searchParams.set('missing', `${from} → ${to}`)
    return NextResponse.redirect(target, 302)
  }
  return NextResponse.redirect(new URL(buildExploreUrl({ node: from, path: [from, to], view }), request.url), 302)
}
