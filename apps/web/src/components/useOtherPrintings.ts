'use client'

import { useEffect, useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { fetchFocus } from '@/lib/api'
import { useGraphStore } from '@/state/graph-store'

export interface OtherPrintings {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** The card's other printings (other sets, other years), most recent first. */
  printings: GraphNode[]
  identityNodeId: string | null
}

function releaseOf(node: GraphNode): string {
  return typeof node.metadata.releaseDate === 'string' ? node.metadata.releaseDate : ''
}

/**
 * For a card printing in focus: every other printing of the same card, across sets. The same
 * card is one identity; its printings hang from it, so the identity's PRINTING_OF neighborhood
 * answers "which expansions does this card appear in?" without leaving the current focus.
 */
export function useOtherPrintings(focus: GraphNode | null): OtherPrintings {
  const edges = useGraphStore((s) => s.edges)
  const identityNodeId =
    focus?.nodeType === 'card_printing'
      ? (edges.find((e) => e.relationshipType === 'PRINTING_OF' && e.sourceNodeId === focus.id)?.targetNodeId ?? null)
      : null
  const [state, setState] = useState<OtherPrintings>({ status: 'idle', printings: [], identityNodeId: null })

  useEffect(() => {
    if (!focus || !identityNodeId) {
      setState({ status: 'idle', printings: [], identityNodeId: null })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading', printings: [], identityNodeId })
    fetchFocus(identityNodeId, { depth: 1, relationshipTypes: ['PRINTING_OF'], limit: 400, perNode: 400 }, controller.signal)
      .then((res) => {
        const printings = res.nodes
          .filter((n) => n.nodeType === 'card_printing' && n.id !== focus.id)
          .sort((a, b) => releaseOf(b).localeCompare(releaseOf(a)) || a.label.localeCompare(b.label))
        setState({ status: 'ready', printings, identityNodeId })
      })
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') setState({ status: 'error', printings: [], identityNodeId })
      })
    return () => controller.abort()
  }, [focus, identityNodeId])

  return state
}
