'use client'

import type { NodeType } from '@constellation/domain'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'

export function NodeBadge({ type, className = '' }: { type: NodeType; className?: string }) {
  const colorOf = useNodeColor()
  const color = colorOf(type)
  return (
    <span className={`chip ${className}`} style={{ borderColor: `${color}66`, color }}>
      <span className="dot" style={{ background: color }} aria-hidden />
      {NODE_TYPE_LABELS[type]}
    </span>
  )
}
