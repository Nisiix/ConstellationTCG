'use client'

import type { NodeType } from '@constellation/domain'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'

/** The node type as a contour chip: colored border, point and text; no fill. */
export function NodeBadge({ type, className = '' }: { type: NodeType; className?: string }) {
  const colorOf = useNodeColor()
  const color = colorOf(type)
  return (
    <span className={`chip ${className}`} style={{ borderColor: `color-mix(in oklab, ${color} 55%, transparent)`, color }}>
      <span className="dot" aria-hidden />
      {NODE_TYPE_LABELS[type]}
    </span>
  )
}
