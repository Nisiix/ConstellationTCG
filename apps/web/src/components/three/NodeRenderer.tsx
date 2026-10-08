'use client'

import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { nodeRadius } from '@/lib/colors'
import { nodeColor, useTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useUiStore } from '@/state/ui-store'
import { navigateTo } from '../navigation'
import { animatedPositions, revealClock, smoothing } from './animated'

const tmpObject = new THREE.Object3D()
const tmpColor = new THREE.Color()

/** Playful reveal: overshoots slightly before settling (ease-out-back). */
function easeOutBack(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  const s = 1.4
  return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2)
}

/**
 * All nodes as one instanced mesh (one draw call) plus a second, slightly larger back-face
 * instanced mesh in the theme's outline color: a toon contour around every node.
 */
export function NodeRenderer() {
  const theme = useTheme()
  const nodes = useGraphStore((s) => s.nodes)
  const positions = useGraphStore((s) => s.positions)
  const distances = useGraphStore((s) => s.distances)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const revision = useGraphStore((s) => s.revision)
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)
  const setHovered = useUiStore((s) => s.setHovered)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const owned = useOwnershipStore((s) => s.ownedNodeIds)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const outlineRef = useRef<THREE.InstancedMesh>(null)
  const count = nodes.length

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    revealClock.startedAt = performance.now()
    revealClock.revision = revision
    const focusPos = focusNodeId ? positions.get(focusNodeId) : undefined
    const ids = new Set<string>()
    for (let i = 0; i < count; i += 1) {
      const node = nodes[i]
      if (!node) continue
      ids.add(node.id)
      tmpColor.set(owned.has(node.id) ? theme.ownership : nodeColor(theme, node.nodeType))
      if (node.id === focusNodeId) tmpColor.multiplyScalar(1.35)
      mesh.setColorAt(i, tmpColor)
      if (!animatedPositions.has(node.id)) {
        const target = positions.get(node.id)
        // New nodes emerge from the focus node and travel to their place.
        const start = focusPos ?? target
        if (start) animatedPositions.set(node.id, [start[0], start[1], start[2]])
      }
    }
    for (const id of [...animatedPositions.keys()]) if (!ids.has(id)) animatedPositions.delete(id)
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [nodes, revision, focusNodeId, owned, positions, count, theme])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const outline = outlineRef.current
    if (!mesh) return
    const k = reducedMotion ? 1 : smoothing(delta, 5.5)
    const elapsed = (performance.now() - revealClock.startedAt) / 1000
    const t = state.clock.elapsedTime
    const pulse = 1 + Math.sin(t * 2.2) * 0.06
    for (let i = 0; i < count; i += 1) {
      const node = nodes[i]
      if (!node) continue
      const target = positions.get(node.id)
      if (!target) continue
      let cur = animatedPositions.get(node.id)
      if (!cur) {
        cur = [target[0], target[1], target[2]]
        animatedPositions.set(node.id, cur)
      }
      cur[0] += (target[0] - cur[0]) * k
      cur[1] += (target[1] - cur[1]) * k
      cur[2] += (target[2] - cur[2]) * k
      const distance = distances[node.id] ?? 1
      const isFocus = node.id === focusNodeId
      const base = nodeRadius(node.nodeType, distance, isFocus)
      const reveal = reducedMotion ? 1 : easeOutBack((elapsed - distance * 0.12) / 0.7)
      const hover = node.id === hoveredNodeId ? 1.3 : 1
      const ownership = owned.has(node.id) ? 1.25 : 1
      const scale = Math.max(0.0001, base * reveal * hover * ownership * (isFocus ? pulse : 1))
      // Gentle idle drift keeps the constellation alive without moving it anywhere.
      const drift = reducedMotion || isFocus ? 0 : 0.08 * Math.min(1, reveal)
      const dx = drift * Math.sin(t * 0.9 + i * 1.7)
      const dy = drift * Math.cos(t * 0.7 + i * 2.3)
      tmpObject.position.set(cur[0] + dx, cur[1] + dy, cur[2])
      tmpObject.scale.setScalar(scale)
      tmpObject.updateMatrix()
      mesh.setMatrixAt(i, tmpObject.matrix)
      if (outline) {
        tmpObject.scale.setScalar(scale * 1.16)
        tmpObject.updateMatrix()
        outline.setMatrixAt(i, tmpObject.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    if (outline) outline.instanceMatrix.needsUpdate = true
  })

  const nodeAt = (event: ThreeEvent<PointerEvent | MouseEvent>) =>
    event.instanceId === undefined ? undefined : nodes[event.instanceId]

  return (
    <group key={`${revision}-${count}`}>
      <instancedMesh ref={outlineRef} args={[undefined, undefined, Math.max(count, 1)]} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[1, 18, 18]} />
        <meshBasicMaterial color={theme.outline} side={THREE.BackSide} toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, Math.max(count, 1)]}
        frustumCulled={false}
        onPointerOver={(event) => {
          event.stopPropagation()
          const node = nodeAt(event)
          if (!node) return
          setHovered(node.id, { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY })
          document.body.style.cursor = 'pointer'
        }}
        onPointerMove={(event) => {
          const node = nodeAt(event)
          if (node && node.id === hoveredNodeId) {
            setHovered(node.id, { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY })
          }
        }}
        onPointerOut={() => {
          setHovered(null)
          document.body.style.cursor = ''
        }}
        onClick={(event) => {
          event.stopPropagation()
          const node = nodeAt(event)
          if (!node || node.id === focusNodeId) return
          setHovered(null)
          document.body.style.cursor = ''
          navigateTo(node.id, { follow: true })
        }}
      >
        <sphereGeometry args={[1, 18, 18]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
