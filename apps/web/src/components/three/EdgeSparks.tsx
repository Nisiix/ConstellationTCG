'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { animatedPositions, revealClock } from './animated'

const MAX_SPARKS = 96

/**
 * Little sparks travelling along the edges that touch the focus node: the relationships are
 * alive, and the eye is pulled from the focus towards what it is connected to.
 */
export function EdgeSparks() {
  const theme = useTheme()
  const edges = useGraphStore((s) => s.edges)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const revision = useGraphStore((s) => s.revision)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const ref = useRef<THREE.Points>(null)
  const dark = theme.mode === 'dark'

  const focusEdges = useMemo(
    () => edges.filter((e) => e.sourceNodeId === focusNodeId || e.targetNodeId === focusNodeId).slice(0, MAX_SPARKS),
    [edges, focusNodeId],
  )
  const positions = useMemo(() => new Float32Array(MAX_SPARKS * 3), [])
  const phases = useMemo(() => Float32Array.from({ length: MAX_SPARKS }, (_, i) => (i * 0.618) % 1), [])

  useFrame((state) => {
    const points = ref.current
    if (!points) return
    if (reducedMotion || focusEdges.length === 0) {
      points.visible = false
      return
    }
    points.visible = true
    const t = state.clock.elapsedTime
    const elapsed = (performance.now() - revealClock.startedAt) / 1000
    const material = points.material as THREE.PointsMaterial
    material.opacity = Math.min(1, Math.max(0, (elapsed - 0.6) / 0.6)) * 0.95
    for (let i = 0; i < MAX_SPARKS; i += 1) {
      const edge = focusEdges[i]
      const o = i * 3
      if (!edge) {
        positions[o] = positions[o + 1] = positions[o + 2] = 1e4
        continue
      }
      // Sparks always flow outwards from the focus.
      const from = animatedPositions.get(focusNodeId as string)
      const toId = edge.sourceNodeId === focusNodeId ? edge.targetNodeId : edge.sourceNodeId
      const to = animatedPositions.get(toId)
      if (!from || !to) {
        positions[o] = positions[o + 1] = positions[o + 2] = 1e4
        continue
      }
      const p = (t * 0.35 + (phases[i] ?? 0)) % 1
      positions[o] = from[0] + (to[0] - from[0]) * p
      positions[o + 1] = from[1] + (to[1] - from[1]) * p
      positions[o + 2] = from[2] + (to[2] - from[2]) * p
    }
    const attribute = points.geometry.getAttribute('position') as THREE.BufferAttribute | undefined
    if (attribute) attribute.needsUpdate = true
  })

  return (
    <points ref={ref} key={`${revision}-${theme.id}-${theme.mode}`} frustumCulled={false} visible={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.55}
        sizeAttenuation
        color={theme.primary}
        transparent
        opacity={0}
        depthWrite={false}
        blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  )
}
