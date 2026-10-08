import { MAX_GRAPH_DEPTH, NODE_TYPES, type FilterDefinition } from '@constellation/domain'

const NODE_TYPE_LABELS: Record<string, string> = {
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

/**
 * Filters every TCG shares. Values are computed per game by the FilterService; filters without a
 * `source` are graph-level (they shape the neighborhood query) rather than printing-level.
 */
export const UNIVERSAL_FILTERS: FilterDefinition[] = [
  { id: 'tcg', label: 'TCG', type: 'select', scope: 'global' },
  {
    id: 'series',
    label: 'Series',
    type: 'select',
    scope: 'global',
    appliesTo: ['card_printing', 'set'],
    source: { kind: 'relation', relation: 'series' },
  },
  {
    id: 'set',
    label: 'Set',
    type: 'select',
    scope: 'global',
    appliesTo: ['card_printing'],
    source: { kind: 'relation', relation: 'set' },
    dependsOn: ['series'],
  },
  {
    id: 'cardType',
    label: 'Card Type',
    type: 'multi',
    scope: 'global',
    appliesTo: ['card_printing'],
    source: { kind: 'column', column: 'category' },
  },
  {
    id: 'rarity',
    label: 'Rarity',
    type: 'multi',
    scope: 'global',
    appliesTo: ['card_printing'],
    source: { kind: 'column', column: 'rarity' },
  },
  {
    id: 'language',
    label: 'Language',
    type: 'multi',
    scope: 'global',
    appliesTo: ['card_printing'],
    source: { kind: 'column', column: 'language' },
  },
  {
    id: 'artist',
    label: 'Artist',
    type: 'select',
    scope: 'global',
    appliesTo: ['card_printing'],
    source: { kind: 'relation', relation: 'artist' },
  },
  {
    id: 'variant',
    label: 'Variant',
    type: 'multi',
    scope: 'global',
    appliesTo: ['card_printing'],
    source: { kind: 'column', column: 'variant' },
  },
  {
    id: 'finish',
    label: 'Finish',
    type: 'multi',
    scope: 'global',
    appliesTo: ['card_printing'],
    source: { kind: 'column', column: 'finish' },
  },
  { id: 'relationship', label: 'Relationship', type: 'multi', scope: 'global' },
  {
    id: 'nodeType',
    label: 'Node Type',
    type: 'multi',
    scope: 'global',
    values: NODE_TYPES.filter((t) => t !== 'digital_asset').map((t) => ({
      value: t,
      label: NODE_TYPE_LABELS[t] ?? t,
    })),
  },
  {
    id: 'graphDepth',
    label: 'Graph Depth',
    type: 'range',
    scope: 'global',
    min: 1,
    max: MAX_GRAPH_DEPTH,
  },
  { id: 'ownership', label: 'Ownership', type: 'boolean', scope: 'global' },
]

/** Ids of filters that shape the graph query rather than the printing set. */
export const GRAPH_LEVEL_FILTER_IDS = new Set(['tcg', 'relationship', 'nodeType', 'graphDepth', 'ownership'])
