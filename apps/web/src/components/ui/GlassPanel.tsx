import type { HTMLAttributes, ReactNode } from 'react'

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  strong?: boolean
}

export function GlassPanel({ children, strong, className = '', ...rest }: GlassPanelProps) {
  return (
    <div className={`glass ${strong ? 'glass-strong' : ''} rounded-lg ${className}`} {...rest}>
      {children}
    </div>
  )
}
