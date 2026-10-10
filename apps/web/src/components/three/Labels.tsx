'use client'

import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type * as THREE from 'three'
import { configureTextBuilder } from 'troika-three-text'
import type { GraphNode, NodeType } from '@constellation/domain'
import { nodeRadius } from '@/lib/colors'
import { useSceneTheme } from '@/lib/theme'
import { skyLabel } from '@/lib/sky-label'
import { useGraphStore } from '@/state/graph-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useTimeStore } from '@/state/time-store'
import { useUiStore } from '@/state/ui-store'
import { displayScales, drawnPosition } from './animated'

const MAX_LABELS = 48

/**
 * Labels are typeset on the main thread with a font served by the app itself. The content security
 * policy allows neither troika's blob-loaded worker scripts (`script-src` has no `blob:`) nor its
 * default font CDN (`connect-src 'self'`); either one blanked the whole sky. A few dozen short
 * labels cost next to nothing to lay out here.
 */
export const LABEL_FONT_URL = '/fonts/Figtree-Medium.ttf'
configureTextBuilder({ useWorker: false, defaultFontURL: LABEL_FONT_URL })

const PRIORITY: Record<NodeType, number> = {
  game: 0,
  series: 1,
  set: 2,
  card_identity: 3,
  pokemon: 4,
  artist: 5,
  card_printing: 6,
  mechanic: 7,
  attribute: 8,
  digital_asset: 9,
}

/** Labels for the focus, its direct neighbors (bounded) and whatever is hovered. */
export function Labels() {
  const nodes = useGraphStore((s) => s.nodes)
  const distances = useGraphStore((s) => s.distances)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)
  const hiddenInTime = useTimeStore((s) => s.hidden)

  const labeled = useMemo(() => {
    const near = nodes.filter((n) => !hiddenInTime.has(n.id) && (n.id === focusNodeId || (distances[n.id] ?? 9) <= 1))
    near.sort((a, b) => {
      if (a.id === focusNodeId) return -1
      if (b.id === focusNodeId) return 1
      return PRIORITY[a.nodeType] - PRIORITY[b.nodeType] || a.label.localeCompare(b.label)
    })
    return near.slice(0, MAX_LABELS)
  }, [nodes, distances, focusNodeId, hiddenInTime])

  const hovered =
    hoveredNodeId && !labeled.some((n) => n.id === hoveredNodeId) ? nodes.find((n) => n.id === hoveredNodeId) : undefined

  return (
    <>
      {labeled.map((node) => (
        <NodeLabel key={node.id} node={node} isFocus={node.id === focusNodeId} distance={distances[node.id] ?? 1} />
      ))}
      {hovered ? <NodeLabel key={`hover-${hovered.id}`} node={hovered} isFocus={false} distance={distances[hovered.id] ?? 2} /> : null}
    </>
  )
}

function NodeLabel({ node, isFocus, distance }: { node: GraphNode; isFocus: boolean; distance: number }) {
  const theme = useSceneTheme()
  const highlight = useUiStore((s) => s.highlight)
  const ownedHere = useOwnershipStore((s) => s.ownedNodeIds.has(node.id))
  const focusOnOwned = useOwnershipStore((s) => s.focusOnOwned && s.ownedNodeIds.size > 0)
  const ref = useRef<THREE.Group>(null)
  const fallbackRadius = nodeRadius(node.nodeType, distance, isFocus)
  useFrame(() => {
    const p = drawnPosition(node.id)
    if (!p || !ref.current) return
    // Hang the label just under the point as it is drawn now (hover and pulse included).
    const radius = (displayScales.get(node.id) ?? fallbackRadius) * 1.14
    ref.current.position.set(p[0], p[1] - radius - 0.4, p[2])
  })
  const size = isFocus ? 0.95 : distance <= 1 ? 0.52 : 0.42
  const dimmed = highlight !== null ? !isFocus && !highlight.has(node.id) : focusOnOwned && !isFocus && !ownedHere
  return (
    <group ref={ref}>
      <Billboard follow>
        <Text
          font={LABEL_FONT_URL}
          fontSize={size}
          color={isFocus ? theme.primary : theme.text}
          anchorX="center"
          anchorY="top"
          maxWidth={14}
          textAlign="center"
          outlineWidth={size * 0.1}
          outlineColor={theme.background}
          fillOpacity={dimmed ? 0.3 : isFocus ? 1 : 0.85}
          letterSpacing={0.02}
        >
          {skyLabel(node.label)}
        </Text>
      </Billboard>
    </group>
  )
}
