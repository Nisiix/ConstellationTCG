/**
 * Hard product rule: no prices, anywhere. Providers return token metadata that may embed market
 * data (exchange rates, floor prices, volumes). Everything that looks like it is removed before
 * the payload is stored or shown.
 */

const MARKET_KEY =
  /(price|pricing|exchange_?rate|floor|volume|market_?cap|fiat|usd|eur|value_?usd|last_?sale|sale_?price|roi|valuation)/i

export function isMarketKey(key: string): boolean {
  return MARKET_KEY.test(key)
}

function isMarketTrait(entry: unknown): boolean {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false
  const e = entry as { trait_type?: unknown; name?: unknown }
  const label =
    typeof e.trait_type === 'string' ? e.trait_type : typeof e.name === 'string' ? e.name : null
  return label !== null && isMarketKey(label)
}

/** Deep copy of `value` without any market-data keys. Arrays and primitives pass through. */
export function stripMarketData<T>(value: T): T {
  if (Array.isArray(value)) {
    // Trait lists (`[{ trait_type, value }]`): a trait *named* like market data goes too.
    return value.filter((v) => !isMarketTrait(v)).map((v) => stripMarketData(v)) as unknown as T
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (isMarketKey(key)) continue
      out[key] = stripMarketData(v)
    }
    return out as T
  }
  return value
}
