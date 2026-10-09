import { ValidationError } from '@constellation/domain'
import type { NextRequest } from 'next/server'
import { isEmail, safeNextPath } from '@/lib/auth-redirect'
import { errorResponse, json, rateLimit, readJson, stringField } from '@/server/http'
import { AccountError, requireSupabase, siteOrigin } from '@/server/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Send a sign-in link by email. No password anywhere. */
export async function POST(request: NextRequest) {
  const limited = rateLimit(request)
  if (limited) return limited
  try {
    const body = await readJson(request)
    const email = (stringField(body, 'email', { required: true, max: 254 }) ?? '').toLowerCase()
    if (!isEmail(email))
      throw new ValidationError('That does not look like an email address', {
        status: 400,
        field: 'email',
      })
    const next = safeNextPath(stringField(body, 'next'))
    const supabase = await requireSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${siteOrigin(request)}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (error) {
      const status =
        typeof error.status === 'number' && error.status >= 400 && error.status < 600
          ? error.status
          : 502
      throw new AccountError(error.message, { status: status === 500 ? 502 : status })
    }
    return json({ sent: true, email }, { cache: 'no-store' })
  } catch (error) {
    return errorResponse(error)
  }
}
