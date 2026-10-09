import { contentHash } from '@constellation/adapters'
import {
  NormalizationError,
  slugify,
  type Finish,
  type IdentityEntityType,
  type NormalizedCard,
  type NormalizedEntityRef,
  type SourceCard,
} from '@constellation/domain'
import { baseSpeciesName, speciesName } from './pokedex'
import { containsForbiddenFields } from './tcgdex/strip'
import type { TCGdexCard } from './tcgdex/types'

const CATEGORY_TO_IDENTITY: Record<string, IdentityEntityType> = {
  pokemon: 'character',
  trainer: 'trainer',
  energy: 'energy',
}

/** TCGdex image base → full-size front image. */
export function imageUrl(base: string | undefined, quality: 'high' | 'low' = 'high'): string | null {
  if (!base) return null
  return `${base.replace(/\/+$/, '')}/${quality}.webp`
}

export function finishFromVariants(variants: TCGdexCard['variants']): Finish {
  if (!variants) return 'normal'
  if (variants.normal) return 'normal'
  if (variants.holo) return 'holo'
  if (variants.reverse) return 'reverse'
  return 'other'
}

export function availableFinishes(variants: TCGdexCard['variants']): string[] {
  if (!variants) return []
  const out: string[] = []
  if (variants.normal) out.push('normal')
  if (variants.holo) out.push('holo')
  if (variants.reverse) out.push('reverse')
  if (variants.firstEdition) out.push('first-edition')
  if (variants.wPromo) out.push('w-promo')
  return out
}

function requireString(raw: Record<string, unknown>, key: string, id: string): string {
  const value = raw[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new NormalizationError(`Card ${id}: missing required field "${key}"`, { key, id })
  }
  return value
}

/**
 * TCGdex card → NormalizedCard.
 *
 * Throws NormalizationError when required fields are missing or forbidden fields (prices) are
 * still present: a record that cannot be normalized is reported, never stored.
 */
export function normalizeCard(source: SourceCard): NormalizedCard {
  const raw = source.raw as unknown as TCGdexCard
  const id = source.externalId
  if (containsForbiddenFields(raw)) {
    throw new NormalizationError(`Card ${id}: payload contains forbidden fields (pricing)`, { id })
  }
  const name = requireString(raw as Record<string, unknown>, 'name', id)
  const localId = requireString(raw as Record<string, unknown>, 'localId', id)
  const set = raw.set
  if (!set || typeof set !== 'object' || typeof set.id !== 'string') {
    throw new NormalizationError(`Card ${id}: missing set reference`, { id })
  }
  if (set.id !== source.setExternalId) {
    throw new NormalizationError(`Card ${id}: set mismatch (${set.id} vs ${source.setExternalId})`, {
      id,
    })
  }

  const category = typeof raw.category === 'string' ? raw.category.toLowerCase() : null
  const identityEntityType: IdentityEntityType =
    (category && CATEGORY_TO_IDENTITY[category]) || 'other'

  const official = set.cardCount?.official
  const printedNumber =
    typeof official === 'number' && official > 0 ? `${localId}/${official}` : localId

  const attributes = compact({
    tcgdexId: raw.id,
    hp: raw.hp,
    types: raw.types,
    stage: raw.stage,
    evolveFrom: raw.evolveFrom,
    dexIds: raw.dexId,
    abilities: raw.abilities,
    attacks: raw.attacks,
    weaknesses: raw.weaknesses,
    resistances: raw.resistances,
    retreat: raw.retreat,
    regulationMark: raw.regulationMark,
    suffix: raw.suffix,
    level: raw.level,
    trainerType: raw.trainerType,
    energyType: raw.energyType,
    effect: raw.effect,
    item: raw.item,
    legal: raw.legal,
    variants: raw.variants,
    finishes: availableFinishes(raw.variants),
  })

  return {
    externalId: id,
    setExternalId: set.id,
    language: source.language,
    name: name.trim(),
    identityEntityType,
    collectorNumber: localId.trim(),
    printedNumber,
    category,
    rarity: typeof raw.rarity === 'string' ? raw.rarity : null,
    variant: 'standard',
    finish: finishFromVariants(raw.variants),
    artistName: typeof raw.illustrator === 'string' && raw.illustrator.trim() ? raw.illustrator.trim() : null,
    imageFront: imageUrl(raw.image),
    imageBack: null,
    description: typeof raw.description === 'string' ? raw.description : null,
    attributes,
    entities: extractEntities(raw, name),
    rawHash: contentHash(raw),
  }
}

export function extractEntities(raw: TCGdexCard, cardName: string): NormalizedEntityRef[] {
  const refs: NormalizedEntityRef[] = []
  const seen = new Set<string>()
  const push = (ref: NormalizedEntityRef) => {
    const key = `${ref.kind}:${ref.key}:${ref.relation}`
    if (seen.has(key)) return
    seen.add(key)
    refs.push(ref)
  }

  for (const dexId of raw.dexId ?? []) {
    if (typeof dexId !== 'number') continue
    push({
      kind: 'pokemon',
      key: `dex:${dexId}`,
      name: speciesName(dexId) ?? baseSpeciesName(cardName),
      relation: 'SAME_POKEMON',
      metadata: { dexId },
    })
  }
  for (const type of raw.types ?? []) {
    if (typeof type !== 'string') continue
    push({ kind: 'attribute', key: `type:${slugify(type)}`, name: type, relation: 'HAS_TYPE' })
  }
  for (const w of raw.weaknesses ?? []) {
    if (!w || typeof w.type !== 'string') continue
    push({
      kind: 'attribute',
      key: `type:${slugify(w.type)}`,
      name: w.type,
      relation: 'WEAK_TO',
      metadata: compact({ value: w.value }),
    })
  }
  for (const r of raw.resistances ?? []) {
    if (!r || typeof r.type !== 'string') continue
    push({
      kind: 'attribute',
      key: `type:${slugify(r.type)}`,
      name: r.type,
      relation: 'RESISTS',
      metadata: compact({ value: r.value }),
    })
  }
  // Abilities, attacks, HP and costs are card data, not relationships: they stay in `attributes`
  // but never become entities, edges or filters (the product explores connections, not stats).
  if (typeof raw.trainerType === 'string') {
    push({
      kind: 'attribute',
      key: `trainer-type:${slugify(raw.trainerType)}`,
      name: raw.trainerType,
      relation: 'HAS_ATTRIBUTE',
    })
  }
  if (typeof raw.energyType === 'string') {
    push({
      kind: 'attribute',
      key: `energy-type:${slugify(raw.energyType)}`,
      name: raw.energyType,
      relation: 'HAS_ATTRIBUTE',
    })
  }
  return refs
}

function compact<T extends Record<string, unknown>>(value: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (v !== undefined && v !== null) out[k] = v
  }
  return out
}
