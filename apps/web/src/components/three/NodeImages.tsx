'use client'

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
/** How far in front of the sphere's center the disc sits, along the line to the camera (sphere radius = 1). */
const DISC_OFFSET = 1.02
/**
 * Runs after the points (priority -1) and the camera (0) have settled for this frame, before the
 * frame is rendered (the effect composer renders at 1): the disc always uses this frame's camera
 * and this frame's drawn point, never last frame's.
 */
const FRAME_PRIORITY_IMAGES = 0.5

const toCamera = new THREE.Vector3()

/**
 * The picture of each point, anchored to its disc:
 *  - cards: the artwork area cropped to a centered square ("cover");
 *  - logos (sets, series): a zoomed, dimmed copy of the logo fills the disc and the readable
 *    logo sits on top, so nothing is left empty.
 * The disc is drawn on the camera-facing side of the sphere, placed and oriented by hand every
 * frame from the same drawn position and size as the sphere (drift, hover and focus pulse
 * included) and from this frame's camera, and sized so that it projects exactly onto the sphere's
 * silhouette: it fills the white disc edge to edge and never slides inside it. A set whose logo is
 * missing or fails to load shows the game's standard logo.
 */
export function NodeImages() {
  const nodes = useGraphStore((s) => s.nodes)
  const distances = useGraphStore((s) => s.distances)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const isUniverse = useGraphStore((s) => s.isUniverse)

  const candidates = useMemo(() => {
    const withImage = nodes.filter(
      (n) => n.imageUrl && (isUniverse || n.id === focusNodeId || (distances[n.id] ?? 9) <= 2),
    )
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
function coverCrop(
  texture: THREE.Texture,
  width: number,
  height: number,
  centerV = 0.5,
  zoom = 1,
): THREE.Texture {
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
      return {
        fill: coverCrop(texture, width, height, 0.5, 1.6),
        front: texture,
        frontScale: scale,
      }
    }
    // Cards: a square around the artwork, which sits in the upper part of the card.
    return {
      fill: coverCrop(texture, width, height, 0.64),
      front: null,
      frontScale: [1, 1] as [number, number],
    }
  }, [texture, logo])

  useFrame(({ camera }) => {
    const g = disc.current
    if (!g) return
    const p = drawnPosition(node.id)
    const radius = displayScales.get(node.id)
    if (!p || radius === undefined) {
      g.visible = false
      return
    }
    g.visible = true
    // From the sphere's center towards the camera: the disc sits just outside the surface, on the
    // exact line of sight, so its center projects onto the sphere's center from any angle.
    toCamera.set(camera.position.x - p[0], camera.position.y - p[1], camera.position.z - p[2])
    const d = toCamera.length()
    if (d <= radius * DISC_OFFSET + 0.001) {
      g.visible = false
      return
    }
    toCamera.multiplyScalar(1 / d)
    const offset = radius * DISC_OFFSET
    g.position.set(
      p[0] + toCamera.x * offset,
      p[1] + toCamera.y * offset,
      p[2] + toCamera.z * offset,
    )
    // Face the camera exactly as it stands this frame.
    g.quaternion.copy(camera.quaternion)
    // The sphere's silhouette projects with radius r / sqrt(d² − r²); a disc at distance d − offset
    // projects with radius R / (d − offset). Equal when R = r · (d − offset) / sqrt(d² − r²).
    const silhouette = Math.sqrt(Math.max(d * d - radius * radius, 1e-6))
    g.scale.setScalar((radius * (d - offset)) / silhouette)
  }, FRAME_PRIORITY_IMAGES)

  if (!layers) return null

  return (
    <group ref={disc} visible={false}>
      <mesh raycast={() => null}>
        <circleGeometry args={[1, 56]} />
        <meshBasicMaterial
          map={layers.fill}
          color={logo ? '#777777' : '#ffffff'}
          toneMapped={false}
        />
      </mesh>
      {layers.front ? (
        <mesh
          position={[0, 0, 0.01]}
          scale={[layers.frontScale[0], layers.frontScale[1], 1]}
          raycast={() => null}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={layers.front} transparent toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  )
}
