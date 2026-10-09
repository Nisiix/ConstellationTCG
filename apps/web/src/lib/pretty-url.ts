import { slugify, type GraphNode } from '@constellation/domain'
import type { ExploreParams } from './url'

/**
 * Readable addresses for the things people share most: a printing
 * (`/card/pokemon/charizard-base-set-4`, or its source id `/card/pokemon/base1-4`) and a set
 * (`/set/pokemon/base-set`). They redirect to the explorer; the UUID form stays the canonical one.
 */

export interface CardSlugParts {
  name: string
  setSlug: string
  number: string
}

export function buildCardSlug(name: string, setSlug: string, number: string): string {
  return `${slugify(name)}-${setSlug}-${slugify(number)}`
}

/**
 * `charizard-base-set-4` → name `charizard`, set `base-set`, number `4`, given the set slugs of
 * the game (the set is the longest known slug ending the middle part). `null` when it does not fit.
 */
export function parseCardSlug(slug: string, setSlugs: readonly string[]): CardSlugParts | null {
  const clean = slug.trim().toLowerCase()
  const tokens = clean.split('-').filter(Boolean)
  if (tokens.length < 3) return null
  const number = tokens[tokens.length - 1] as string
  const middle = tokens.slice(0, -1).join('-')
  let best: string | null = null
  for (const setSlug of setSlugs) {
    const s = setSlug.toLowerCase()
    if (
      middle.length > s.length + 1 &&
      middle.endsWith(`-${s}`) &&
      (best === null || s.length > best.length)
    )
      best = s
  }
  if (!best) return null
  const name = middle.slice(0, -(best.length + 1))
  if (!name) return null
  return { name, setSlug: best, number }
}

/** `/card/<game>/<slug>` or `/set/<game>/<slug>` for a point that has one; null otherwise. */
export function prettyNodePath(
  node: Pick<GraphNode, 'nodeType' | 'label' | 'metadata'>,
  game: string,
): string | null {
  const m = node.metadata
  if (
    node.nodeType === 'card_printing' &&
    typeof m.setSlug === 'string' &&
    m.setSlug &&
    typeof m.collectorNumber === 'string' &&
    m.collectorNumber
  ) {
    return `/card/${encodeURIComponent(game)}/${buildCardSlug(node.label, m.setSlug, m.collectorNumber)}`
  }
  if (node.nodeType === 'set' && typeof m.slug === 'string' && m.slug) {
    return `/set/${encodeURIComponent(game)}/${encodeURIComponent(m.slug)}`
  }
  return null
}

/** The pretty path plus the view's depth, mode and filters (carried through the redirect). */
export function prettySharePath(
  node: Pick<GraphNode, 'nodeType' | 'label' | 'metadata'>,
  params: ExploreParams,
): string | null {
  const path = prettyNodePath(node, params.game)
  if (!path) return null
  const search = new URLSearchParams()
  if (params.depth !== 1) search.set('depth', String(params.depth))
  if (params.view) search.set('view', params.view)
  for (const [id, value] of Object.entries(params.filters)) if (value) search.set(`f.${id}`, value)
  const query = search.toString()
  return query ? `${path}?${query}` : path
}
