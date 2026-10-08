'use client'

import { NODE_TYPE_LABELS } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'

export function NodeTooltip() {
  const tooltip = useUiStore((s) => s.tooltip)
  const node = useGraphStore((s) => (tooltip ? s.nodes.find((n) => n.id === tooltip.nodeId) : undefined))
  const colorOf = useNodeColor()
  if (!tooltip || !node) return null
  return (
    <div
      role="tooltip"
      className="glass fade-up pointer-events-none fixed z-40 max-w-xs rounded-lg px-3 py-2 text-xs"
      style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorOf(node.nodeType), boxShadow: '0 0 0 1px var(--c-outline)' }} aria-hidden />
        <span className="text-ink">{node.label}</span>
        <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: colorOf(node.nodeType) }}>
          {NODE_TYPE_LABELS[node.nodeType]}
        </span>
      </div>
      {node.subtitle ? <div className="mt-0.5 text-ink-dim">{node.subtitle}</div> : null}
    </div>
  )
}
