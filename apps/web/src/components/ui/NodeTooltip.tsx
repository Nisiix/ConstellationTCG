'use client'

import { NODE_TYPE_LABELS } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'

export function NodeTooltip() {
  const tooltip = useUiStore((s) => s.tooltip)
  const node = useGraphStore((s) => (tooltip ? s.nodes.find((n) => n.id === tooltip.nodeId) : undefined))
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const colorOf = useNodeColor()
  if (!tooltip || !node) return null
  const color = colorOf(node.nodeType)
  return (
    <div role="tooltip" className="panel fade-up pointer-events-none fixed z-40 max-w-xs px-3 py-2 text-[13px]" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
      <div className="flex items-center gap-2">
        <span className="dot" style={{ color }} aria-hidden />
        <span className="text-ink">{node.label}</span>
        <span className="text-[12px]" style={{ color }}>
          {NODE_TYPE_LABELS[node.nodeType]}
        </span>
      </div>
      {node.subtitle ? <div className="mt-0.5 text-ink-dim">{node.subtitle}</div> : null}
      {node.id !== focusNodeId ? <div className="mt-1 text-[11.5px] text-ink-dim/80">Click to fly here</div> : null}
    </div>
  )
}
