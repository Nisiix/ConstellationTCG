'use client'

import { Billboard, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type * as THREE from 'three'
import type { GraphNode, NodeType } from '@constellation/domain'
import { nodeRadius } from '@/lib/colors'
import { useTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { animatedPositions } from './animated'

const MAX_LABELS = 48

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

  const labeled = useMemo(() => {
    const near = nodes.filter((n) => n.id === focusNodeId || (distances[n.id] ?? 9) <= 1)
    near.sort((a, b) => {
      if (a.id === focusNodeId) return -1
      if (b.id === focusNodeId) return 1
      return PRIORITY[a.nodeType] - PRIORITY[b.nodeType] || a.label.localeCompare(b.label)
    })
    return near.slice(0, MAX_LABELS)
  }, [nodes, distances, focusNodeId])

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
  const theme = useTheme()
  const ref = useRef<THREE.Group>(null)
  const offset = nodeRadius(node.nodeType, distance, isFocus) + 0.45
  useFrame(() => {
    const p = animatedPositions.get(node.id)
    if (p && ref.current) ref.current.position.set(p[0], p[1] - offset, p[2])
  })
  const size = isFocus ? 0.95 : distance <= 1 ? 0.52 : 0.42
  return (
    <group ref={ref}>
      <Billboard follow>
        <Text
          fontSize={size}
          color={isFocus ? theme.primary : theme.text}
          anchorX="center"
          anchorY="top"
          maxWidth={14}
          textAlign="center"
          outlineWidth={size * 0.1}
          outlineColor={theme.background}
          fillOpacity={isFocus ? 1 : 0.85}
          letterSpacing={0.02}
        >
          {node.label}
        </Text>
      </Billboard>
    </group>
  )
}
