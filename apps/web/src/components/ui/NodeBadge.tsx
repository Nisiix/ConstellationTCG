'use client'

import type { NodeType } from '@constellation/domain'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'

export function NodeBadge({ type, className = '' }: { type: NodeType; className?: string }) {
  const colorOf = useNodeColor()
  const color = colorOf(type)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${className}`}
      style={{ borderColor: `${color}66`, color, boxShadow: '0 0 0 1px var(--c-outline)' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {NODE_TYPE_LABELS[type]}
    </span>
  )
}
