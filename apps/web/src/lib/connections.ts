import type { NodeType } from '@constellation/domain'

/**
 * What counts as a connection in the explorer: other cards (printings and the cards they print),
 * the catalog they belong to (sets, series, the game) and the artist, the way to the other cards
 * they illustrated. Pokémon species and energy types are in the graph but step aside by default;
 * the "Node type" filter brings them back when asked.
 */
export const CONNECTION_NODE_TYPES: NodeType[] = [
  'game',
  'series',
  'set',
  'card_identity',
  'card_printing',
  'artist',
]

/** The node types to request for a neighborhood: the person's own filter wins over the default. */
export function connectionNodeTypes(filters: Record<string, string>): NodeType[] | undefined {
  return filters.nodeType ? undefined : CONNECTION_NODE_TYPES
}
