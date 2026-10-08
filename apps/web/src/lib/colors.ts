import type { NodeType } from '@constellation/domain'

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  game: 'Game',
  series: 'Series',
  set: 'Set',
  card_identity: 'Card',
  card_printing: 'Printing',
  pokemon: 'Pokémon',
  artist: 'Artist',
  mechanic: 'Mechanic',
  attribute: 'Attribute',
  digital_asset: 'Digital asset',
}

export const RELATIONSHIP_LABELS: Record<string, string> = {
  BELONGS_TO: 'Set',
  PART_OF: 'Part of',
  PRINTING_OF: 'Card',
  ILLUSTRATED_BY: 'Artist',
  SAME_POKEMON: 'Pokémon',
  EVOLVES_FROM: 'Evolves from',
  EVOLUTION_OF: 'Evolution of',
  HAS_TYPE: 'Type',
  WEAK_TO: 'Weak to',
  RESISTS: 'Resists',
  HAS_ATTACK: 'Attack',
  HAS_ABILITY: 'Ability',
  HAS_ATTRIBUTE: 'Attribute',
  SAME_IDENTITY: 'Same card',
  ALTERNATE_PRINTING: 'Alternate printing',
  REPRINT_OF: 'Reprint of',
  RELATED_TO: 'Related',
  REPRESENTS_ASSET: 'Digital asset',
  OWNED_BY: 'Owned by',
}

/** Label for a relationship seen from a given side of the edge. */
export function relationshipLabel(type: string, direction: 'out' | 'in'): string {
  if (direction === 'in') {
    switch (type) {
      case 'BELONGS_TO':
        return 'Cards'
      case 'PART_OF':
        return 'Contains'
      case 'PRINTING_OF':
        return 'Printings'
      case 'ILLUSTRATED_BY':
        return 'Illustrations'
      case 'SAME_POKEMON':
        return 'Cards'
      case 'EVOLVES_FROM':
        return 'Evolves into'
      case 'EVOLUTION_OF':
        return 'Evolves into'
      case 'HAS_TYPE':
        return 'Cards of this type'
      case 'WEAK_TO':
        return 'Weak to this'
      case 'RESISTS':
        return 'Resist this'
      case 'HAS_ATTACK':
        return 'Cards with this attack'
      case 'HAS_ABILITY':
        return 'Cards with this ability'
      case 'HAS_ATTRIBUTE':
        return 'Cards'
    }
  }
  return RELATIONSHIP_LABELS[type] ?? humanize(type)
}

export function humanize(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Visual size of a node by type and hop distance from the focus. */
export function nodeRadius(type: NodeType, distance: number, isFocus: boolean): number {
  if (isFocus) return 1.5
  const base: Record<NodeType, number> = {
    game: 1.4,
    series: 1.1,
    set: 0.95,
    card_identity: 0.85,
    card_printing: 0.75,
    pokemon: 0.8,
    artist: 0.8,
    mechanic: 0.5,
    attribute: 0.6,
    digital_asset: 0.7,
  }
  const scale = distance <= 1 ? 1 : distance === 2 ? 0.7 : 0.5
  return base[type] * scale
}

/** Group ordering in the focus panel: most semantic first. */
export const RELATIONSHIP_ORDER = [
  'PRINTING_OF',
  'SAME_POKEMON',
  'BELONGS_TO',
  'PART_OF',
  'ILLUSTRATED_BY',
  'EVOLVES_FROM',
  'EVOLUTION_OF',
  'HAS_TYPE',
  'WEAK_TO',
  'RESISTS',
  'HAS_ABILITY',
  'HAS_ATTACK',
  'HAS_ATTRIBUTE',
]
