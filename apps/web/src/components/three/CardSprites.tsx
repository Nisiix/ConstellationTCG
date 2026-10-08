'use client'

import { Billboard } from '@react-three/drei'
import { useFrame, useLoader } from '@react-three/fiber'
import { Component, Suspense, useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { GraphNode } from '@constellation/domain'
import { useTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { animatedPositions, smoothing } from './animated'

const CARD_TYPES = new Set(['card_printing', 'card_identity'])

/**
 * The card image floats next to the focus (and the hovered card). Neighbors stay points: the
 * constellation never turns into a card grid.
 */
export function CardSprites() {
  const nodes = useGraphStore((s) => s.nodes)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)

  const cards: GraphNode[] = []
  for (const id of [focusNodeId, hoveredNodeId]) {
    const node = id ? nodes.find((n) => n.id === id) : undefined
    if (node && CARD_TYPES.has(node.nodeType) && node.imageUrl && !cards.includes(node)) cards.push(node)
  }

  return (
    <>
      {cards.map((node) => (
        <SpriteBoundary key={node.id}>
          <Suspense fallback={null}>
            <CardSprite node={node} large={node.id === focusNodeId} />
          </Suspense>
        </SpriteBoundary>
      ))}
    </>
  )
}

function CardSprite({ node, large }: { node: GraphNode; large: boolean }) {
  const theme = useTheme()
  const texture = useLoader(THREE.TextureLoader, node.imageUrl as string)
  const ref = useRef<THREE.Group>(null)
  const scale = useRef(0)

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    texture.needsUpdate = true
  }, [texture])

  useFrame((state, delta) => {
    const p = animatedPositions.get(node.id)
    const group = ref.current
    if (!p || !group) return
    const offset = large ? 3.6 : 2.4
    const bob = large ? Math.sin(state.clock.elapsedTime * 1.3) * 0.12 : 0
    group.position.set(p[0] + offset, p[1] + 0.8 + bob, p[2])
    scale.current += (1 - scale.current) * smoothing(delta, 7)
    const s = Math.max(0.0001, scale.current)
    // ease-out-back pop
    const pop = 1 + (1 - s) * 0.25
    group.scale.setScalar(s * pop)
  })

  const height = large ? 5.8 : 3.4
  const width = height * 0.716
  return (
    <group ref={ref}>
      <Billboard follow>
        <mesh position={[0, 0, -0.03]}>
          <planeGeometry args={[width + 0.3, height + 0.3]} />
          <meshBasicMaterial color={theme.outline} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[width + 0.16, height + 0.16]} />
          <meshBasicMaterial color={theme.primary} transparent opacity={0.55} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial map={texture} transparent toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  )
}

/** A broken image must not take the whole scene down. */
class SpriteBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}
