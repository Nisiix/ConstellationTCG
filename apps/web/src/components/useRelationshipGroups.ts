'use client'

import { useMemo } from 'react'
import { compareCollectorNumbers, type GraphNode } from '@constellation/domain'
import { RELATIONSHIP_ORDER, relationshipLabel } from '@/lib/colors'
import { useGraphStore } from '@/state/graph-store'

export interface RelationshipGroup {
  key: string
  relationshipType: string
  direction: 'out' | 'in'
  label: string
  /** Total edges of this kind touching the focus (from the server summary, not capped). */
  total: number
  items: Array<{ node: GraphNode; weight: number; metadata: Record<string, unknown> }>
}

type Item = RelationshipGroup['items'][number]

function releaseOf(node: GraphNode): string {
  const m = node.metadata
  const value = m.releaseDate ?? m.firstReleaseDate
  return typeof value === 'string' ? value : ''
}

/**
 * How the items of a group are ordered:
 *  - expansions (sets, series) and printings: most recent first, so the newest set is on top;
 *  - the cards of a set: by collector number, as in the set list;
 *  - everything else: strongest relationship first, then by name.
 */
export function sortGroupItems(items: Item[], focus: GraphNode | null): Item[] {
  const sorted = items.slice()
  const first = sorted[0]?.node
  if (!first) return sorted
  const allSame = sorted.every((i) => i.node.nodeType === first.nodeType)
  if (allSame && (first.nodeType === 'set' || first.nodeType === 'series' || first.nodeType === 'card_printing') && focus?.nodeType !== 'set') {
    sorted.sort((a, b) => releaseOf(b.node).localeCompare(releaseOf(a.node)) || a.node.label.localeCompare(b.node.label))
    return sorted
  }
  if (allSame && first.nodeType === 'card_printing' && focus?.nodeType === 'set') {
    sorted.sort((a, b) =>
      compareCollectorNumbers(String(a.node.metadata.collectorNumber ?? ''), String(b.node.metadata.collectorNumber ?? '')),
    )
    return sorted
  }
  sorted.sort((a, b) => b.weight - a.weight || a.node.label.localeCompare(b.node.label))
  return sorted
}

/** Direct relationships of the focus node, grouped by type and direction. */
export function useRelationshipGroups(): { focus: GraphNode | null; groups: RelationshipGroup[] } {
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const summary = useGraphStore((s) => s.summary)

  return useMemo(() => {
    if (!focusNodeId) return { focus: null, groups: [] }
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const focus = byId.get(focusNodeId) ?? null
    const groups = new Map<string, RelationshipGroup>()
    for (const edge of edges) {
      let direction: 'out' | 'in'
      let otherId: string
      if (edge.sourceNodeId === focusNodeId) {
        direction = 'out'
        otherId = edge.targetNodeId
      } else if (edge.targetNodeId === focusNodeId) {
        direction = 'in'
        otherId = edge.sourceNodeId
      } else continue
      const other = byId.get(otherId)
      if (!other) continue
      const key = `${edge.relationshipType}:${direction}`
      const group =
        groups.get(key) ??
        ({
          key,
          relationshipType: edge.relationshipType,
          direction,
          label: relationshipLabel(edge.relationshipType, direction),
          total: 0,
          items: [],
        } satisfies RelationshipGroup)
      group.items.push({ node: other, weight: edge.weight, metadata: edge.metadata })
      groups.set(key, group)
    }
    for (const s of summary) {
      const key = `${s.relationshipType}:${s.direction}`
      const group = groups.get(key)
      if (group) group.total = s.count
      else if (s.count > 0) {
        groups.set(key, {
          key,
          relationshipType: s.relationshipType,
          direction: s.direction,
          label: relationshipLabel(s.relationshipType, s.direction),
          total: s.count,
          items: [],
        })
      }
    }
    const order = new Map(RELATIONSHIP_ORDER.map((t, i) => [t, i]))
    const list = [...groups.values()]
    for (const g of list) {
      g.items = sortGroupItems(g.items, focus)
      if (g.total < g.items.length) g.total = g.items.length
    }
    list.sort(
      (a, b) =>
        (order.get(a.relationshipType) ?? 99) - (order.get(b.relationshipType) ?? 99) ||
        a.direction.localeCompare(b.direction),
    )
    return { focus, groups: list }
  }, [focusNodeId, nodes, edges, summary])
}
