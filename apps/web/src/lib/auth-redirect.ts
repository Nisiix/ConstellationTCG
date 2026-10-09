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
