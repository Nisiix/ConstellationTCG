import type { FilterDefinition, TCGDefinition, TCGTheme } from '@constellation/domain'

/** The classic Pokémon TCG logo (Base Set), used when a set or series has no logo of its own. */
export const POKEMON_PLACEHOLDER_LOGO = 'https://assets.tcgdex.net/en/base/base1/logo.webp'

/**
 * Pokémon palette: red and white are contours only (rings, borders, edges, active states).
 * Backgrounds are a dirty black in dark mode and a dirty white in light mode.
 */
export const POKEMON_THEME: TCGTheme = {
  id: 'pokemon',
  primary: '#e3242b',
  accent: '#f08a8f',
  ownership: '#e0b25a',
  nodes: {
    game: 'contrast',
    series: 'primary',
    set: 'primary',
    card_identity: 'contrast',
    card_printing: 'contrast',
    pokemon: 'contrast',
    artist: 'contrast',
    attribute: 'muted',
    digital_asset: 'accent',
  },
  edges: {
    BELONGS_TO: 'primary',
    PART_OF: 'primary',
    PRINTING_OF: 'contrast',
    REPRINT_OF: 'contrast',
    ILLUSTRATED_BY: 'contrast',
    SAME_POKEMON: 'contrast',
    EVOLVES_FROM: 'contrast',
    EVOLUTION_OF: 'contrast',
    HAS_TYPE: 'muted',
    WEAK_TO: 'muted',
    RESISTS: 'muted',
    HAS_ATTRIBUTE: 'muted',
  },
  modes: {
    dark: {
      background: '#141214',
      surface: 'rgba(30, 27, 29, 0.76)',
      text: '#f3eeea',
      textDim: '#a69a98',
      nodeFill: '#1d1a1b',
      contrast: '#f7f3ee',
      muted: '#6b5f61',
      particles: '#4b3a3d',
    },
    light: {
      background: '#f3efe8',
      surface: 'rgba(255, 252, 247, 0.82)',
      text: '#1b1618',
      textDim: '#6f6366',
      nodeFill: '#fbf8f3',
      contrast: '#1b1618',
      muted: '#a59c98',
      particles: '#cdc3bc',
    },
  },
}

/** Relationship types specific to Pokémon, emitted by this adapter. */
export const POKEMON_RELATIONSHIPS = [
  'EVOLVES_FROM',
  'EVOLVES_TO',
  'HAS_TYPE',
  'WEAK_TO',
  'RESISTS',
  'SAME_POKEMON',
  'SAME_EVOLUTION_LINE',
] as const

export type PokemonRelationship = (typeof POKEMON_RELATIONSHIPS)[number]

/** Game filters. Card stats and print marks (HP, attacks, abilities, costs, regulation mark) are deliberately not filters: they are data, not relationships. */
export const POKEMON_FILTERS: FilterDefinition[] = [
  {
    id: 'pokemon.species',
    label: 'Pokémon',
    type: 'select',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'entity', entityKind: 'pokemon', relation: 'SAME_POKEMON' },
  },
  {
    id: 'pokemon.type',
    label: 'Type',
    type: 'multi',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'attribute', path: 'types', array: true },
  },
  {
    id: 'pokemon.stage',
    label: 'Evolution stage',
    type: 'multi',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'attribute', path: 'stage' },
  },
  {
    id: 'pokemon.weakness',
    label: 'Weakness',
    type: 'multi',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'entity', entityKind: 'attribute', relation: 'WEAK_TO' },
  },
  {
    id: 'pokemon.resistance',
    label: 'Resistance',
    type: 'multi',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'entity', entityKind: 'attribute', relation: 'RESISTS' },
  },
]

export const POKEMON_DEFINITION: TCGDefinition = {
  slug: 'pokemon',
  name: 'Pokémon Trading Card Game',
  publisher: 'The Pokémon Company',
  adapterKey: 'pokemon',
  relationshipTypes: [...POKEMON_RELATIONSHIPS],
  nodeTypes: ['pokemon', 'attribute'],
  filters: POKEMON_FILTERS,
  theme: POKEMON_THEME,
  placeholderImages: {
    game: POKEMON_PLACEHOLDER_LOGO,
    series: POKEMON_PLACEHOLDER_LOGO,
    set: POKEMON_PLACEHOLDER_LOGO,
  },
}

export const TCGDEX_SOURCE_NAME = 'tcgdex'
