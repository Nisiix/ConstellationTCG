import type { HTMLAttributes, ReactNode } from 'react'

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  strong?: boolean
}

/** Shared translucent surface used by floating panels. */
export function GlassPanel({ children, strong, className = '', ...rest }: PanelProps) {
  return (
    <div className={`panel ${strong ? 'panel-strong' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}
