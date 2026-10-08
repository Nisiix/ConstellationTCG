import type { GraphNode, NodeType } from '@constellation/domain'

/** Node types whose image is a wide logo (sets, series, the game) rather than a portrait card. */
export function isLogoType(type: NodeType): boolean {
  return type === 'set' || type === 'series' || type === 'game'
}

/** A smaller variant of a TCGdex card image, for thumbnails and node discs. */
export function thumbnailUrl(url: string): string {
  return url.replace(/\/high\.webp$/, '/low.webp')
}

/**
 * Where to go when an image cannot be shown: the game's standard image for that node type
 * (Pokémon: the classic Base Set logo), unless that is what already failed.
 */
export function fallbackImageUrl(
  node: Pick<GraphNode, 'nodeType' | 'imageUrl'>,
  placeholders: Partial<Record<NodeType, string>>,
): string | null {
  const fallback = placeholders[node.nodeType]
  if (!fallback) return null
  return fallback === node.imageUrl ? null : fallback
}
