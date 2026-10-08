import type { FilterDefinition, TCGDefinition, TCGTheme } from '@constellation/domain'

/**
 * Pokémon palette: white and red with black contours, on a near-black background.
 * Structural edges are red, semantic edges white; the species ring is pink-red.
 */
export const POKEMON_THEME: TCGTheme = {
  id: 'pokemon',
  background: '#09070a',
  surface: 'rgba(30, 16, 20, 0.66)',
  primary: '#ff2f45',
  secondary: '#ffffff',
  accent: '#ffd6db',
  outline: '#000000',
  text: '#fff5f6',
  textDim: '#caa9b0',
  particles: '#6b2430',
  nodes: {
    game: '#ffffff',
    series: '#ff2f45',
    set: '#ff6d7d',
    card_identity: '#ffffff',
    card_printing: '#ffe6e9',
    pokemon: '#ff9aa6',
    artist: '#ffd6db',
    mechanic: '#e2495c',
    attribute: '#b8303f',
    digital_asset: '#ffd166',
  },
  edges: {
    BELONGS_TO: '#ff2f45',
    PART_OF: '#ff6d7d',
    PRINTING_OF: '#ffffff',
    ILLUSTRATED_BY: '#ffd6db',
    SAME_POKEMON: '#ff9aa6',
    EVOLVES_FROM: '#ffffff',
    EVOLUTION_OF: '#ffffff',
    HAS_TYPE: '#e2495c',
    WEAK_TO: '#b8303f',
    RESISTS: '#b8303f',
    HAS_ATTACK: '#ff8593',
    HAS_ABILITY: '#ff8593',
    HAS_ATTRIBUTE: '#b8303f',
  },
  ownership: '#ffd166',
}

/** Relationship types specific to Pokémon, emitted by this adapter. */
export const POKEMON_RELATIONSHIPS = [
  'EVOLVES_FROM',
  'EVOLVES_TO',
  'HAS_TYPE',
  'HAS_ABILITY',
  'HAS_ATTACK',
  'WEAK_TO',
  'RESISTS',
  'SAME_POKEMON',
  'SAME_EVOLUTION_LINE',
] as const

export type PokemonRelationship = (typeof POKEMON_RELATIONSHIPS)[number]

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
    id: 'pokemon.hp',
    label: 'HP',
    type: 'range',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'attribute', path: 'hp', numeric: true },
  },
  {
    id: 'pokemon.stage',
    label: 'Evolution Stage',
    type: 'multi',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'attribute', path: 'stage' },
  },
  {
    id: 'pokemon.ability',
    label: 'Ability',
    type: 'select',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'entity', entityKind: 'mechanic', relation: 'HAS_ABILITY' },
  },
  {
    id: 'pokemon.attack',
    label: 'Attack',
    type: 'select',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'entity', entityKind: 'mechanic', relation: 'HAS_ATTACK' },
  },
  {
    id: 'pokemon.retreat',
    label: 'Retreat Cost',
    type: 'range',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'attribute', path: 'retreat', numeric: true },
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
  {
    id: 'pokemon.regulationMark',
    label: 'Regulation Mark',
    type: 'multi',
    scope: 'game',
    appliesTo: ['card_printing'],
    source: { kind: 'attribute', path: 'regulationMark' },
  },
]

export const POKEMON_DEFINITION: TCGDefinition = {
  slug: 'pokemon',
  name: 'Pokémon Trading Card Game',
  publisher: 'The Pokémon Company',
  adapterKey: 'pokemon',
  relationshipTypes: [...POKEMON_RELATIONSHIPS],
  nodeTypes: ['pokemon', 'attribute', 'mechanic'],
  filters: POKEMON_FILTERS,
  theme: POKEMON_THEME,
}

export const TCGDEX_SOURCE_NAME = 'tcgdex'
