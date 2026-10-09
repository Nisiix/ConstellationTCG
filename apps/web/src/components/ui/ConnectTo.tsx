'use client'

import { useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { useExploreNavigation } from '../navigation'
import { SearchBar } from './SearchBar'

/**
 * "Connect to…": the way to ask for a path. The button opens a search; the point picked there is
 * the other end, and the sky shows the path from this point to it.
 */
export function ConnectTo({ node, className = '' }: { node: Pick<GraphNode, 'id' | 'label'>; className?: string }) {
  const navigation = useExploreNavigation()
  const [open, setOpen] = useState(false)
  return (
    <div className={`relative z-20 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`btn pill text-[12.5px] ${open ? 'btn-on' : 'btn-ghost'}`}
        title="Find the path from this point to another one"
      >
        Connect to…
      </button>
      {open ? (
        <div className="fade-up mt-3" data-testid="connect-to">
          <SearchBar
            shortcut={false}
            inline
            autoFocus
            exclude={[node.id]}
            label={`Connect ${node.label} to…`}
            placeholder="Connect to a card, set or artist…"
            onPick={(hit) => {
              setOpen(false)
              navigation.startPath(node.id, hit.nodeId)
            }}
            onEscape={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  )
}
