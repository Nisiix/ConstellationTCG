import { NextResponse, type NextRequest } from 'next/server'
import { safeNextPath } from '@/lib/auth-redirect'
import { createSupabaseServer } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Where the email link lands: the one-time code becomes a session (cookies), then the visitor
 * returns to the explorer with My Constellation open.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const next = safeNextPath(params.get('next'))
  const target = new URL(next, request.url)
  const supabase = await createSupabaseServer()
  if (!supabase) {
    target.searchParams.set('account', 'unconfigured')
    return NextResponse.redirect(target)
  }
  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const type = params.get('type')
  let failed = false
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    failed = Boolean(error)
  } else if (
    tokenHash &&
    (type === 'email' || type === 'magiclink' || type === 'signup' || type === 'recovery')
  ) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    failed = Boolean(error)
  } else {
    failed = true
  }
  target.searchParams.set('account', failed ? 'error' : 'signed-in')
  return NextResponse.redirect(target)
}
