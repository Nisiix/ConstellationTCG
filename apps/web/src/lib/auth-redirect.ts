/** Only a same-origin path may be a post-sign-in destination (no open redirects). */
export function safeNextPath(value: string | null | undefined, fallback = '/explore'): string {
  if (!value) return fallback
  const trimmed = value.trim()
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    /[\u0000-\u001f]/.test(trimmed)
  )
    return fallback
  return trimmed
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isEmail(value: string): boolean {
  return value.length <= 254 && EMAIL.test(value)
}

const AUTH_PARAMS = [
  'code',
  'token_hash',
  'type',
  'error',
  'error_code',
  'error_description',
] as const

/**
 * Where a sign-in link should be handled when Supabase sent it back to the Site URL instead of
 * `/auth/callback` (the callback path is not on the project's redirect allow list yet): the same
 * code or token hash, re-addressed to the callback, with the page it landed on as `next`.
 * `null` when the location carries no sign-in parameters or already is the callback.
 */
export function authCallbackRedirect(href: string): string | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.pathname === '/auth/callback') return null
  const params = url.searchParams
  const hasCode = Boolean(params.get('code'))
  const hasToken = Boolean(params.get('token_hash') && params.get('type'))
  const hasError = Boolean(params.get('error') || params.get('error_code'))
  if (!hasCode && !hasToken && !hasError) return null
  const callback = new URLSearchParams()
  for (const key of AUTH_PARAMS) {
    const value = params.get(key)
    if (value) callback.set(key, value)
    params.delete(key)
  }
  const rest = params.toString()
  callback.set('next', safeNextPath(`${url.pathname}${rest ? `?${rest}` : ''}`))
  return `/auth/callback?${callback.toString()}`
}
