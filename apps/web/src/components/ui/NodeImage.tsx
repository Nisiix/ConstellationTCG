'use client'

import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import type { GraphNode } from '@constellation/domain'
import { fallbackImageUrl, isLogoType, thumbnailUrl } from '@/lib/images'
import { useNodeColor } from '@/lib/theme'
import { useCatalogStore } from '@/state/catalog-store'

type Variant = 'card' | 'logo' | 'thumb'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  node: Pick<GraphNode, 'id' | 'nodeType' | 'label' | 'imageUrl'>
  variant?: Variant
  /** Load the smaller image variant (thumbnails, lists). */
  small?: boolean
  /** Rendered when neither the image nor the fallback can be shown. Default: a colored point. */
  placeholder?: React.ReactNode
}

/**
 * A node's picture with the same fallback rule as the 3D scene: when the image is missing or
 * fails to load, the game's standard image for that node type is shown (Pokémon: the classic
 * logo); when even that fails, a colored point.
 */
export function NodeImage({ node, variant, small, placeholder, className = '', alt, ...rest }: Props) {
  const placeholders = useCatalogStore((s) => s.placeholders)
  const colorOf = useNodeColor()
  const fallback = fallbackImageUrl(node, placeholders)
  const initial = node.imageUrl ?? fallback
  const [src, setSrc] = useState<string | null>(initial)
  useEffect(() => setSrc(node.imageUrl ?? fallback), [node.id, node.imageUrl, fallback])

  const kind: Variant = variant ?? (isLogoType(node.nodeType) ? 'logo' : 'card')
  if (!src) {
    return (
      placeholder ?? (
        <span
          className={`flex flex-none items-center justify-center rounded-md ${className}`}
          style={{ background: `color-mix(in oklab, ${colorOf(node.nodeType)} 14%, transparent)` }}
          aria-hidden
        >
          <span className="dot" style={{ color: colorOf(node.nodeType) }} />
        </span>
      )
    )
  }
  const shown = small ? thumbnailUrl(src) : src
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...rest}
      src={shown}
      alt={alt ?? `${node.label} ${kind === 'card' ? 'card' : 'logo'}`}
      data-fallback={src !== node.imageUrl ? 'true' : undefined}
      className={className}
      onError={() => setSrc((current) => (current && fallback && current !== fallback ? fallback : null))}
    />
  )
}
