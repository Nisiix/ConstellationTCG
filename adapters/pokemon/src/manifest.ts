import type { FilterDefinition, TCGDefinition } from '@constellation/domain'

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
}

export const TCGDEX_SOURCE_NAME = 'tcgdex'
