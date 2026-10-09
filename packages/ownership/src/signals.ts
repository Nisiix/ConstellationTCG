import type { AssetMatchSignals } from '@constellation/domain'
import type { ProviderAsset } from './types'

const SIGNAL_KEYS: Array<[keyof AssetMatchSignals, RegExp]> = [
  ['set', /^(set|expansion|set ?name|series)$/i],
  ['cardNumber', /^(card ?number|number|card ?no\.?|collector ?number|no)$/i],
  ['language', /^(language|lang)$/i],
  ['variant', /^(variant|version)$/i],
  ['finish', /^(finish|foil|holo)$/i],
  ['edition', /^(edition)$/i],
  ['artist', /^(artist|illustrator)$/i],
]

const EXTERNAL_ID_KEYS: Array<[source: string, RegExp]> = [
  ['tcgdex', /^(tcgdex|tcgdex ?id|card ?id|external ?id)$/i],
]

/**
 * What the resolver can learn from a token's metadata. Trait names are matched loosely (`Set`,
 * `Expansion`, `Card Number`, …); the token name is the card name once a trailing `#123` or a
 * ` - Set Name` suffix is removed.
 */
export function signalsFromAsset(asset: ProviderAsset, game: string): AssetMatchSignals {
  const signals: AssetMatchSignals = { game }
  if (asset.name) signals.name = cleanName(asset.name)
  if (asset.imageUri) signals.imageUri = asset.imageUri
  const externalIds: Record<string, string> = {}
  for (const [key, raw] of Object.entries(asset.attributes)) {
    const value = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : ''
    if (!value) continue
    for (const [signal, pattern] of SIGNAL_KEYS) {
      if (pattern.test(key) && signals[signal] === undefined)
        (signals as Record<string, unknown>)[signal] = value
    }
    for (const [source, pattern] of EXTERNAL_ID_KEYS) {
      if (pattern.test(key)) externalIds[source] = value
    }
  }
  if (Object.keys(externalIds).length) signals.externalIds = externalIds
  signals.platformMetadata = {
    platform: asset.platform,
    chain: asset.chain,
    contractAddress: asset.contractAddress,
    tokenId: asset.tokenId,
  }
  return signals
}

function cleanName(name: string): string {
  let current = name.trim()
  // `Charizard #4 - Base Set`, `Charizard - Base Set #4`, `Charizard #4/102`: peel suffixes until stable.
  for (let i = 0; i < 3; i += 1) {
    const next = current
      .replace(/\s*#\s*\d+(\s*\/\s*\d+)?\s*$/, '')
      .replace(/\s+[-–—]\s+[^-–—]+$/, '')
      .trim()
    if (next === current || !next) break
    current = next
  }
  return current || name.trim()
}
