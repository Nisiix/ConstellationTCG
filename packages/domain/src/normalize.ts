/**
 * Normalization helpers shared by every adapter.
 *
 * Identity resolution must not create duplicates: "Charizard", "CHARIZARD" and " charizard "
 * normalize to the same key. Diacritics are folded ("Pokemon" with an accent -> "pokemon") so that
 * search and identity keys are accent-insensitive.
 */

const WHITESPACE = /\s+/g
const DIACRITICS = /[̀-ͯ]/g

export function foldDiacritics(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS, '')
}

/** Canonical identity key: lowercase, accent-folded, single-spaced, trimmed. */
export function normalizeName(value: string): string {
  return foldDiacritics(value).toLowerCase().replace(WHITESPACE, ' ').trim()
}

/** URL-safe slug. Keeps letters and digits; everything else becomes a single dash. */
export function slugify(value: string): string {
  return foldDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Deterministic JSON serialization (sorted keys) so that content hashes are stable. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key]
      if (v !== undefined) out[key] = sortKeys(v)
    }
    return out
  }
  return value
}

/** Collector number as printed ("4/102") -> canonical number ("4"). */
export function collectorNumberFromPrinted(printed: string): string {
  const slash = printed.indexOf('/')
  return (slash >= 0 ? printed.slice(0, slash) : printed).trim()
}

/**
 * Sort key for collector numbers: numeric parts compare numerically ("2" < "10"), prefixed
 * numbers ("SV045", "TG12") sort after plain ones, and ties fall back to the raw string.
 */
export function collectorNumberSortKey(value: string): [number, number, string] {
  const match = /^([A-Za-z]*)(\d+)([A-Za-z]*)$/.exec(value.trim())
  if (!match) return [2, 0, value]
  const prefix = match[1] ?? ''
  const digits = match[2] ?? '0'
  return [prefix ? 1 : 0, Number(digits), value]
}

export function compareCollectorNumbers(a: string, b: string): number {
  const [pa, na, sa] = collectorNumberSortKey(a)
  const [pb, nb, sb] = collectorNumberSortKey(b)
  return pa - pb || na - nb || sa.localeCompare(sb)
}
