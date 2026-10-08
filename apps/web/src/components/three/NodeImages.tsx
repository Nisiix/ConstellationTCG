'use client'

import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GraphNode } from '@constellation/domain'
import { fallbackImageUrl } from '@/lib/images'
import { useCatalogStore } from '@/state/catalog-store'
import { useGraphStore } from '@/state/graph-store'
import { displayScales, drawnPosition } from './animated'
import { isLogoNode, nodeDiscImageUrl, useNodeTexture } from './textures'

const MAX_IMAGES = 320
/** How far in front of the sphere's center the disc sits (sphere radius = 1). */
const DISC_OFFSET = 1.02
/** Disc radius relative to the sphere: leaves a rim of the neutral fill before the contour. */
const DISC_RADIUS = 0.94

const tmpVec = new THREE.Vector3()

/**
 * The picture of each point, filling its disc edge to edge:
 *  - cards: the artwork area cropped to a centered square ("cover");
 *  - logos (sets, series): a zoomed, dimmed copy of the logo fills the disc and the readable
 *    logo sits on top, so nothing is left empty.
 * The disc is drawn on the camera-facing side of the sphere, at exactly the size and position the
 * sphere was drawn with this frame (drift, hover and focus pulse included) and shrunk to cancel
 * the perspective magnification of sitting closer to the camera, so it never leaves the point.
 * A set whose logo is missing or fails to load shows the game's standard logo.
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
        <NodeImage key={node.id} node={node} />
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

function NodeImage({ node }: { node: GraphNode }) {
  const placeholders = useCatalogStore((s) => s.placeholders)
  const texture = useNodeTexture(nodeDiscImageUrl(node), fallbackImageUrl(node, placeholders))
  const group = useRef<THREE.Group>(null)
  const disc = useRef<THREE.Group>(null)
  const logo = isLogoNode(node)

  const layers = useMemo(() => {
    if (!texture) return null
    const image = texture.image as { width?: number; height?: number } | undefined
    const width = image?.width ?? 1
    const height = image?.height ?? 1
    if (logo) {
      const aspect = width / height
      // Fit the readable logo inside the disc (inscribed square, with a little margin).
      const fit = 1.26
      const scale: [number, number] = aspect >= 1 ? [fit, fit / aspect] : [fit * aspect, fit]
      return { fill: coverCrop(texture, width, height, 0.5, 1.6), front: texture, frontScale: scale }
    }
    // Cards: a square around the artwork, which sits in the upper part of the card.
    return { fill: coverCrop(texture, width, height, 0.64), front: null, frontScale: [1, 1] as [number, number] }
  }, [texture, logo])

  useFrame(({ camera }) => {
    const g = group.current
    if (!g) return
    const p = drawnPosition(node.id)
    const scale = displayScales.get(node.id)
    if (!p || scale === undefined) {
      g.visible = false
      return
    }
    g.visible = true
    g.position.set(p[0], p[1], p[2])
    g.scale.setScalar(scale)
    if (disc.current) {
      // The disc is DISC_OFFSET * scale closer to the camera than the sphere's center: shrink it by
      // the same ratio so its projected size never exceeds the sphere's.
      const d = tmpVec.set(p[0], p[1], p[2]).distanceTo(camera.position)
      const ratio = Math.max(0.5, (d - DISC_OFFSET * scale) / Math.max(d, 0.001))
      disc.current.scale.setScalar(ratio)
    }
  })

  if (!layers) return null

  return (
    <group ref={group} visible={false}>
      <Billboard follow>
        {/* pushed towards the camera so the disc sits on the front of the sphere */}
        <group ref={disc} position={[0, 0, DISC_OFFSET]}>
          <mesh raycast={() => null}>
            <circleGeometry args={[DISC_RADIUS, 48]} />
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
