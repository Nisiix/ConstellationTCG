'use client'

import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type ComponentRef } from 'react'
import * as THREE from 'three'
import { layoutRadius } from '@/lib/layout'
import { useCameraStore } from '@/state/camera-store'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { animatedPositions, easeInOutCubic } from './animated'

interface Flight {
  active: boolean
  start: number
  duration: number
  fromPos: THREE.Vector3
  fromTarget: THREE.Vector3
  distance: number
  nodeId: string | null
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const tmpTarget = new THREE.Vector3()
const tmpDir = new THREE.Vector3()
const tmpPos = new THREE.Vector3()

/**
 * Semantic camera: every focus change is a flight (400–900ms, eased) towards the focus node.
 * In `follow` mode the current framing distance is kept, so clicking a relationship glides along
 * the edge; in `focus` mode the camera re-frames to fit the new neighborhood.
 */
export function CameraController() {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const camera = useThree((s) => s.camera)
  const targetNodeId = useCameraStore((s) => s.targetNodeId)
  const mode = useCameraStore((s) => s.mode)
  const flightId = useCameraStore((s) => s.flightId)
  const setTransition = useCameraStore((s) => s.setTransition)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const positions = useGraphStore((s) => s.positions)
  const revision = useGraphStore((s) => s.revision)
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const flight = useRef<Flight | null>(null)

  useEffect(() => {
    const nodeId = targetNodeId ?? focusNodeId
    const controls = controlsRef.current
    const fromTarget = controls ? controls.target.clone() : new THREE.Vector3()
    const currentDistance = camera.position.distanceTo(fromTarget)
    const center = positions.get(nodeId ?? '') ?? [0, 0, 0]
    const radius = layoutRadius(positions, center)
    const frameDistance = clamp(radius * 1.3 + 8, 18, 95)
    // Following an edge keeps the current framing, but never so close that a hub overflows the view.
    const distance = isUniverse
      ? clamp(radius * 1.15 + 12, 36, 140)
      : mode === 'follow'
        ? clamp(Math.max(currentDistance, frameDistance * 0.8), 14, 80)
        : frameDistance
    flight.current = {
      active: true,
      start: performance.now(),
      duration: reducedMotion ? 0 : 850,
      fromPos: camera.position.clone(),
      fromTarget,
      distance,
      nodeId,
    }
    if (controls) controls.enabled = false
    setTransition('moving')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId, revision])

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    const f = flight.current
    if (f?.active) {
      const target: [number, number, number] = f.nodeId
        ? (animatedPositions.get(f.nodeId) ?? positions.get(f.nodeId) ?? [0, 0, 0])
        : [0, 0, 0]
      tmpTarget.set(target[0], target[1], target[2])
      tmpDir.copy(f.fromPos).sub(f.fromTarget)
      if (tmpDir.lengthSq() < 1e-4) tmpDir.set(0, 0.35, 1)
      tmpDir.normalize()
      tmpPos.copy(tmpTarget).add(tmpDir.multiplyScalar(f.distance))
      const t = f.duration === 0 ? 1 : easeInOutCubic((performance.now() - f.start) / f.duration)
      camera.position.lerpVectors(f.fromPos, tmpPos, t)
      controls.target.lerpVectors(f.fromTarget, tmpTarget, t)
      camera.lookAt(controls.target)
      if (t >= 1) {
        f.active = false
        controls.enabled = true
        controls.update()
        setTransition('idle')
      }
      return
    }
    // Idle: keep the orbit target glued to the (possibly still settling) focus node.
    const nodeId = targetNodeId ?? focusNodeId
    const p = nodeId ? animatedPositions.get(nodeId) : undefined
    if (p) {
      tmpTarget.set(p[0], p[1], p[2])
      if (controls.target.distanceToSquared(tmpTarget) > 1e-4) controls.target.lerp(tmpTarget, 0.1)
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.55}
      zoomSpeed={0.9}
      panSpeed={0.6}
      minDistance={3}
      maxDistance={240}
    />
  )
}
