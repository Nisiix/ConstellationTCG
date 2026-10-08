'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { edgeColor, useTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { animatedPositions, easeOutCubic, revealClock } from './animated'

const tmpColor = new THREE.Color()

/** Every edge as one additive line-segments geometry, animated to "grow" from source to target. */
export function EdgeRenderer() {
  const theme = useTheme()
  const edges = useGraphStore((s) => s.edges)
  const positions = useGraphStore((s) => s.positions)
  const distances = useGraphStore((s) => s.distances)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const revision = useGraphStore((s) => s.revision)
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const geometryRef = useRef<THREE.BufferGeometry>(null)

  const buffers = useMemo(() => {
    const n = edges.length
    const position = new Float32Array(n * 6)
    const color = new Float32Array(n * 6)
    const base = new Float32Array(n * 3)
    edges.forEach((edge, i) => {
      tmpColor.set(edgeColor(theme, edge.relationshipType))
      base[i * 3] = tmpColor.r
      base[i * 3 + 1] = tmpColor.g
      base[i * 3 + 2] = tmpColor.b
    })
    return { position, color, base }
  }, [edges, theme])

  useFrame((state) => {
    const geometry = geometryRef.current
    if (!geometry) return
    const elapsed = (performance.now() - revealClock.startedAt) / 1000
    const breathe = reducedMotion ? 1 : 0.9 + Math.sin(state.clock.elapsedTime * 1.8) * 0.1
    const { position, color, base } = buffers
    for (let i = 0; i < edges.length; i += 1) {
      const edge = edges[i]
      if (!edge) continue
      const s = animatedPositions.get(edge.sourceNodeId) ?? positions.get(edge.sourceNodeId)
      const t = animatedPositions.get(edge.targetNodeId) ?? positions.get(edge.targetNodeId)
      const o = i * 6
      if (!s || !t) {
        position.fill(0, o, o + 6)
        color.fill(0, o, o + 6)
        continue
      }
      const d = Math.min(distances[edge.sourceNodeId] ?? 1, distances[edge.targetNodeId] ?? 1)
      const progress = reducedMotion ? 1 : easeOutCubic((elapsed - 0.12 - d * 0.12) / 0.55)
      position[o] = s[0]
      position[o + 1] = s[1]
      position[o + 2] = s[2]
      position[o + 3] = s[0] + (t[0] - s[0]) * progress
      position[o + 4] = s[1] + (t[1] - s[1]) * progress
      position[o + 5] = s[2] + (t[2] - s[2]) * progress

      const touchesFocus = edge.sourceNodeId === focusNodeId || edge.targetNodeId === focusNodeId
      const touchesHover =
        hoveredNodeId !== null && (edge.sourceNodeId === hoveredNodeId || edge.targetNodeId === hoveredNodeId)
      const intensity =
        (touchesHover ? 1.15 : touchesFocus ? 0.85 * breathe : d >= 2 ? 0.18 : 0.42) * progress
      const r = base[i * 3] ?? 0
      const g = base[i * 3 + 1] ?? 0
      const b = base[i * 3 + 2] ?? 0
      color[o] = r * intensity
      color[o + 1] = g * intensity
      color[o + 2] = b * intensity
      color[o + 3] = r * intensity * 0.55
      color[o + 4] = g * intensity * 0.55
      color[o + 5] = b * intensity * 0.55
    }
    const pos = geometry.getAttribute('position') as THREE.BufferAttribute | undefined
    const col = geometry.getAttribute('color') as THREE.BufferAttribute | undefined
    if (pos) pos.needsUpdate = true
    if (col) col.needsUpdate = true
  })

  if (edges.length === 0) return null

  return (
    <lineSegments key={`${revision}-${theme.id}`} frustumCulled={false}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[buffers.position, 3]} />
        <bufferAttribute attach="attributes-color" args={[buffers.color, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </lineSegments>
  )
}
