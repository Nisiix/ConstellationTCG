/**
 * Remove everything the product must never store from a TCGdex payload.
 *
 *  - `pricing` (anywhere in the tree): Constellation is not a price tracker.
 *  - `variants_detailed`: carries marketplace product ids and pricing.
 *  - `thirdParty`: marketplace identifiers.
 *  - `updated` (top level): volatile timestamp that would churn content hashes.
 */
const FORBIDDEN_KEYS = new Set(['pricing', 'variants_detailed', 'thirdParty'])
const VOLATILE_TOP_LEVEL_KEYS = new Set(['updated'])

export function stripForbiddenFields<T>(value: T): T {
  return strip(value, true) as T
}

function strip(value: unknown, topLevel: boolean): unknown {
  if (Array.isArray(value)) return value.map((v) => strip(v, false))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) continue
      if (topLevel && VOLATILE_TOP_LEVEL_KEYS.has(key)) continue
      out[key] = strip(v, false)
    }
    return out
  }
  return value
}

/** True when a payload still contains a forbidden key anywhere (used by tests and validators). */
export function containsForbiddenFields(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenFields)
  if (value && typeof value === 'object') {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) return true
      if (containsForbiddenFields(v)) return true
    }
  }
  return false
}
