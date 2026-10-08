'use client'

import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GraphNode } from '@constellation/domain'
import { nodeRadius } from '@/lib/colors'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { animatedPositions, revealClock } from './animated'
import { isLogoNode, nodeDiscImageUrl, useNodeTexture } from './textures'

const MAX_IMAGES = 320

function easeOutBack(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  const s = 1.4
  return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2)
}

/**
 * The picture of each point, filling its disc edge to edge:
 *  - cards: the artwork area cropped to a centered square ("cover");
 *  - logos (sets, series): a zoomed, dimmed copy of the logo fills the disc and the readable
 *    logo sits on top, so nothing is left empty.
 * Discs are drawn on the camera-facing side of the sphere; the colored rim and the dark contour
 * stay visible around them.
 */
export function NodeImages() {
  const nodes = useGraphStore((s) => s.nodes)
  const distances = useGraphStore((s) => s.distances)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const isUniverse = useGraphStore((s) => s.isUniverse)

  const candidates = useMemo(() => {
    const withImage = nodes.filter((n) => n.imageUrl && (isUniverse || n.id === focusNodeId || (distances[n.id] ?? 9) <= 2))
    withImage.sort((a, b) => (distances[a.id] ?? 9) - (distances[b.id] ?? 9))
    return withImage.slice(0, MAX_IMAGES)
  }, [nodes, distances, focusNodeId, isUniverse])

  return (
    <>
      {candidates.map((node) => (
        <NodeImage key={node.id} node={node} distance={distances[node.id] ?? 1} isFocus={node.id === focusNodeId} />
      ))}
    </>
  )
}

/** Clone a texture cropped to a centered square ("cover"), optionally centered on a vertical point. */
function coverCrop(texture: THREE.Texture, width: number, height: number, centerV = 0.5, zoom = 1): THREE.Texture {
  const t = texture.clone()
  t.wrapS = THREE.ClampToEdgeWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  const aspect = width / height
  // The visible UV window is a square: full width for portrait images, full height for wide ones.
  let rw = 1
  let rh = 1
  if (aspect >= 1) rw = 1 / aspect
  else rh = aspect
  rw /= zoom
  rh /= zoom
  const ox = Math.min(1 - rw, Math.max(0, 0.5 - rw / 2))
  const oy = Math.min(1 - rh, Math.max(0, centerV - rh / 2))
  t.repeat.set(rw, rh)
  t.offset.set(ox, oy)
  t.needsUpdate = true
  return t
}

function NodeImage({ node, distance, isFocus }: { node: GraphNode; distance: number; isFocus: boolean }) {
  const texture = useNodeTexture(nodeDiscImageUrl(node))
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const group = useRef<THREE.Group>(null)
  const logo = isLogoNode(node)
  const baseRadius = nodeRadius(node.nodeType, distance, isFocus)

  const layers = useMemo(() => {
    if (!texture) return null
    const image = texture.image as { width?: number; height?: number } | undefined
    const width = image?.width ?? 1
    const height = image?.height ?? 1
    if (logo) {
      const aspect = width / height
      // Fit the readable logo inside the disc (inscribed square, with a little margin).
      const fit = 1.3
      const scale: [number, number] = aspect >= 1 ? [fit, fit / aspect] : [fit * aspect, fit]
      return { fill: coverCrop(texture, width, height, 0.5, 1.6), front: texture, frontScale: scale }
    }
    // Cards: a square around the artwork, which sits in the upper part of the card.
    return { fill: coverCrop(texture, width, height, 0.64), front: null, frontScale: [1, 1] as [number, number] }
  }, [texture, logo])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = animatedPositions.get(node.id)
    if (!p) {
      g.visible = false
      return
    }
    g.visible = true
    const elapsed = (performance.now() - revealClock.startedAt) / 1000
    const reveal = reducedMotion ? 1 : easeOutBack((elapsed - distance * 0.12) / 0.7)
    const hover = node.id === hoveredNodeId ? 1.3 : 1
    const scale = Math.max(0.0001, baseRadius * reveal * hover)
    g.position.set(p[0], p[1], p[2])
    g.scale.setScalar(scale)
  })

  if (!layers) return null

  return (
    <group ref={group} visible={false}>
      <Billboard follow>
        {/* pushed slightly towards the camera so the disc sits on the front of the sphere */}
        <group position={[0, 0, 1.02]}>
          <mesh raycast={() => null}>
            <circleGeometry args={[0.96, 48]} />
            <meshBasicMaterial map={layers.fill} color={logo ? '#777777' : '#ffffff'} toneMapped={false} />
          </mesh>
          {layers.front ? (
            <mesh position={[0, 0, 0.01]} scale={[layers.frontScale[0], layers.frontScale[1], 1]} raycast={() => null}>
              <planeGeometry args={[1, 1]} />
              <meshBasicMaterial map={layers.front} transparent toneMapped={false} />
            </mesh>
          ) : null}
        </group>
      </Billboard>
    </group>
  )
}
