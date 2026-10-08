/** Query-string parsing helpers shared by API routes (pure, no server-only imports). */

export function intParam(value: string | null | undefined, fallback: number, min: number, max: number): number {
  if (value === null || value === undefined || value.trim() === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.floor(n)))
}

export function listParam(value: string | null | undefined): string[] | null {
  if (!value) return null
  const items = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  return items.length ? items : null
}

/** Collect `f.<id>=value` query parameters into a raw filter record. */
export function filterParams(searchParams: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('f.') && value) out[key.slice(2)] = value
  }
  return out
}
