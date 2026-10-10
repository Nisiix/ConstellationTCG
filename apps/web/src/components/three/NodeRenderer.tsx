'use client'

import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { nodeRadius } from '@/lib/colors'
import { nodeColor, useSceneTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useTimeStore } from '@/state/time-store'
import { useUiStore } from '@/state/ui-store'
import { navigateTo } from '../navigation'
import {
  FRAME_PRIORITY_NODES,
  animatedPositions,
  displayPositions,
  displayScales,
  easeOutBack,
  revealClock,
  smoothing,
  timePresence,
} from './animated'

const tmpObject = new THREE.Object3D()
const tmpColor = new THREE.Color()
const fillColor = new THREE.Color()
const contrastColor = new THREE.Color()
const backgroundColor = new THREE.Color()

/**
 * Every point is a neutral sphere (the scene's node fill) wrapped in a contour shell colored by
 * node type (red for sets, white for cards in the Pokémon theme). Two instanced meshes, two draw
 * calls, whatever the size of the neighborhood. Runs first in the frame loop and publishes where
 * and how big each point was drawn, so images, labels, halos and edges stay centered on it.
 */
export function NodeRenderer() {
  const theme = useSceneTheme()
  const nodes = useGraphStore((s) => s.nodes)
  const positions = useGraphStore((s) => s.positions)
  const distances = useGraphStore((s) => s.distances)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const revision = useGraphStore((s) => s.revision)
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)
  const highlight = useUiStore((s) => s.highlight)
  const setHovered = useUiStore((s) => s.setHovered)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const owned = useOwnershipStore((s) => s.ownedNodeIds)
  const focusOnOwned = useOwnershipStore((s) => s.focusOnOwned && s.ownedNodeIds.size > 0)
  const hiddenInTime = useTimeStore((s) => s.hidden)
  const freshInTime = useTimeStore((s) => s.fresh)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const contourRef = useRef<THREE.InstancedMesh>(null)
  const count = nodes.length

  // Colors: contour by node type (dimmed when a highlight singles out other points), neutral fill.
  useEffect(() => {
    const mesh = meshRef.current
    const contour = contourRef.current
    if (!mesh || !contour) return
    fillColor.set(theme.nodeFill)
    contrastColor.set(theme.contrast)
    backgroundColor.set(theme.background)
    for (let i = 0; i < count; i += 1) {
      const node = nodes[i]
      if (!node) continue
      const isFocus = node.id === focusNodeId
      // A hover highlight wins; otherwise "only mine" dims whatever is not owned.
      const dimmed = highlight !== null ? !isFocus && !highlight.has(node.id) : focusOnOwned && !isFocus && !owned.has(node.id)
      tmpColor.set(owned.has(node.id) ? theme.ownership : nodeColor(theme, node.nodeType))
      if (isFocus) tmpColor.lerp(contrastColor, 0.25)
      // What appeared in the year of the time cursor shines brighter.
      else if (freshInTime.has(node.id)) tmpColor.lerp(contrastColor, 0.45)
      if (dimmed) tmpColor.lerp(backgroundColor, 0.72)
      contour.setColorAt(i, tmpColor)
      tmpColor.copy(fillColor)
      if (isFocus) tmpColor.lerp(contrastColor, 0.12)
      mesh.setColorAt(i, tmpColor)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (contour.instanceColor) contour.instanceColor.needsUpdate = true
  }, [nodes, focusNodeId, owned, focusOnOwned, count, theme, highlight, freshInTime])

  // A new neighborhood: restart the reveal and let new points emerge from the focus.
  useEffect(() => {
    revealClock.startedAt = performance.now()
    revealClock.revision = revision
    const focusPos = focusNodeId ? positions.get(focusNodeId) : undefined
    const ids = new Set<string>()
    for (const node of nodes) {
      ids.add(node.id)
      if (!animatedPositions.has(node.id)) {
        const target = positions.get(node.id)
        const start = focusPos ?? target
        if (start) animatedPositions.set(node.id, [start[0], start[1], start[2]])
      }
    }
    for (const id of [...animatedPositions.keys()]) {
      if (!ids.has(id)) {
        animatedPositions.delete(id)
        displayPositions.delete(id)
        displayScales.delete(id)
        timePresence.delete(id)
      }
    }
  }, [nodes, revision, focusNodeId, positions])

  useFrame((state, delta) => {
    const mesh = meshRef.current
    const contour = contourRef.current
    if (!mesh) return
    const k = reducedMotion ? 1 : smoothing(Math.min(delta, 0.1), 5.5)
    const elapsed = (performance.now() - revealClock.startedAt) / 1000
    const t = state.clock.elapsedTime
    const pulse = 1 + Math.sin(t * 2.2) * 0.05
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
      const hovered = node.id === hoveredNodeId
      const hover = hovered ? 1.3 : 1
      const ownership = owned.has(node.id) ? 1.25 : 1
      // In time: points not yet in the sky shrink away, those of the cursor's year stand out.
      const wanted = hiddenInTime.has(node.id) ? 0 : 1
      const presence = timePresence.get(node.id) ?? wanted
      const present = reducedMotion ? wanted : presence + (wanted - presence) * smoothing(Math.min(delta, 0.1), 7)
      timePresence.set(node.id, present)
      const fresh = freshInTime.has(node.id) ? 1.18 : 1
      const scale = Math.max(0.0001, base * reveal * hover * ownership * fresh * present * (isFocus ? pulse : 1))
      // Gentle idle drift keeps the constellation alive without moving it anywhere.
      const drift = reducedMotion || isFocus ? 0 : 0.08 * Math.min(1, reveal)
      const x = cur[0] + drift * Math.sin(t * 0.9 + i * 1.7)
      const y = cur[1] + drift * Math.cos(t * 0.7 + i * 2.3)
      const z = cur[2]
      // Publish the drawn position and size for everything attached to this point.
      let drawn = displayPositions.get(node.id)
      if (!drawn) {
        drawn = [x, y, z]
        displayPositions.set(node.id, drawn)
      } else {
        drawn[0] = x
        drawn[1] = y
        drawn[2] = z
      }
      displayScales.set(node.id, scale)
      tmpObject.position.set(x, y, z)
      tmpObject.scale.setScalar(scale)
      tmpObject.updateMatrix()
      mesh.setMatrixAt(i, tmpObject.matrix)
      if (contour) {
        // The contour thickens on the focus and under the pointer.
        tmpObject.scale.setScalar(scale * (isFocus ? 1.2 : hovered ? 1.19 : 1.14))
        tmpObject.updateMatrix()
        contour.setMatrixAt(i, tmpObject.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    // three caches the bounding sphere used by raycasting the first time it is needed; points
    // move after that (they emerge from the focus), so invalidate it so every point stays
    // clickable wherever it travels.
    mesh.boundingSphere = null
    if (contour) contour.instanceMatrix.needsUpdate = true
  }, FRAME_PRIORITY_NODES)

  const nodeAt = (event: ThreeEvent<PointerEvent | MouseEvent>) =>
    event.instanceId === undefined ? undefined : nodes[event.instanceId]

  return (
    <group key={`${revision}-${count}`}>
      <instancedMesh ref={contourRef} args={[undefined, undefined, Math.max(count, 1)]} frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial side={THREE.BackSide} toneMapped={false} />
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
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
