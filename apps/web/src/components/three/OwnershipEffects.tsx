'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSceneTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useUiStore } from '@/state/ui-store'
import { displayScales, drawnPosition, easeOutCubic, revealClock } from './animated'
import { useHaloTexture } from './SelectionEffects'

const MAX_HALOS = 600
const tmpObject = new THREE.Object3D()

/**
 * My Constellation in the sky: every owned point wears a soft halo in the ownership color, breathing
 * slowly. One instanced mesh, one draw call, whatever the size of the collection; each halo follows
 * the drawn position and size of its point and faces the camera.
 */
export function OwnershipEffects() {
  const theme = useSceneTheme()
  const texture = useHaloTexture(theme.ownership)
  const nodes = useGraphStore((s) => s.nodes)
  const owned = useOwnershipStore((s) => s.ownedNodeIds)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const camera = useThree((s) => s.camera)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const ownedHere = useMemo(
    () =>
      nodes
        .filter((n) => owned.has(n.id))
        .slice(0, MAX_HALOS)
        .map((n) => n.id),
    [nodes, owned],
  )

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const t = state.clock.elapsedTime
    const elapsed = (performance.now() - revealClock.startedAt) / 1000
    const reveal = reducedMotion ? 1 : easeOutCubic((elapsed - 0.2) / 0.6)
    for (let i = 0; i < ownedHere.length; i += 1) {
      const id = ownedHere[i] as string
      const p = drawnPosition(id)
      if (!p) {
        tmpObject.scale.setScalar(0.0001)
      } else {
        const radius = displayScales.get(id) ?? 0.8
        const breathe = reducedMotion ? 1 : 1 + Math.sin(t * 1.4 + i * 0.9) * 0.08
        tmpObject.position.set(p[0], p[1], p[2])
        tmpObject.quaternion.copy(camera.quaternion)
        tmpObject.scale.setScalar(Math.max(0.0001, radius * 3.6 * breathe * reveal))
      }
      tmpObject.updateMatrix()
      mesh.setMatrixAt(i, tmpObject.matrix)
    }
    mesh.count = ownedHere.length
    mesh.instanceMatrix.needsUpdate = true
  })

  if (!texture || ownedHere.length === 0) return null

  return (
    <instancedMesh
      key={`${theme.id}-${ownedHere.length}`}
      ref={meshRef}
      args={[undefined, undefined, Math.max(1, ownedHere.length)]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.55}
        toneMapped={false}
      />
    </instancedMesh>
  )
}
