'use client'

import { useMemo } from 'react'
import { NODE_TYPE_LABELS, relationshipLabel } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { ElementIcon, elementOfNode } from './ElementIcon'

/** Name, kind and — the part that explains the line — how the point relates to the focus. */
export function NodeTooltip() {
  const tooltip = useUiStore((s) => s.tooltip)
  const node = useGraphStore((s) => (tooltip ? s.nodes.find((n) => n.id === tooltip.nodeId) : undefined))
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const focus = useGraphStore((s) => (s.focusNodeId ? s.nodes.find((n) => n.id === s.focusNodeId) : undefined))
  const edges = useGraphStore((s) => s.edges)
  const colorOf = useNodeColor()

  const relations = useMemo(() => {
    if (!node || !focusNodeId || node.id === focusNodeId) return []
    const labels = new Set<string>()
    for (const e of edges) {
      if (e.sourceNodeId === focusNodeId && e.targetNodeId === node.id) labels.add(relationshipLabel(e.relationshipType, 'out'))
      else if (e.targetNodeId === focusNodeId && e.sourceNodeId === node.id) labels.add(relationshipLabel(e.relationshipType, 'in'))
    }
    return [...labels]
  }, [edges, focusNodeId, node])

  if (!tooltip || !node) return null
  const color = colorOf(node.nodeType)
  return (
    <div role="tooltip" className="panel fade-up pointer-events-none fixed z-40 max-w-xs px-3 py-2 text-[13px]" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
      <div className="flex items-center gap-2">
        <span className="dot" style={{ color }} aria-hidden />
        {elementOfNode(node) ? <ElementIcon element={elementOfNode(node) as NonNullable<ReturnType<typeof elementOfNode>>} /> : null}
        <span className="text-ink">{node.label}</span>
        <span className="text-[12px]" style={{ color }}>
          {NODE_TYPE_LABELS[node.nodeType]}
        </span>
      </div>
      {node.subtitle ? <div className="mt-0.5 text-ink-dim">{node.subtitle}</div> : null}
      {relations.length > 0 && focus ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-ink/10 pt-1.5 text-[12px]">
          <span className="text-ink-dim">{focus.label} →</span>
          {relations.map((r) => (
            <span key={r} className="chip text-[11.5px]">
              {r}
            </span>
          ))}
        </div>
      ) : node.id !== focusNodeId ? (
        <div className="mt-1 text-[11.5px] text-ink-dim/80">Click to fly here</div>
      ) : null}
    </div>
  )
}
