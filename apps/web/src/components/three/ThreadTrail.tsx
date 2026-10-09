'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { stepBrightness, THREAD_MAX_STEPS } from '@/lib/thread'
import { useThreadStore } from '@/state/thread-store'
import { useUiStore } from '@/state/ui-store'
import { drawnPosition } from './animated'

/** Particles per stretch of thread, and how fast they travel (stretches per second). */
const PER_SEGMENT = 18
const SPEED = 0.22
const MAX_PARTICLES = (THREAD_MAX_STEPS - 1) * PER_SEGMENT
/** The thread's own light: a pale silver, apart from the gold of My Constellation and the lines. */
const THREAD_COLOR = new THREE.Color('#dfe7ff')
const HIDDEN = 1e4

/**
 * The thread in the sky: a trail of particles flowing from each visited point to the next, in the
 * direction of the journey, plus a small light on every step. The last twelve steps are fully lit,
 * older ones fade. Points that are no longer in the neighborhood keep the place where they were
 * drawn (the layout is continuous), so the journey stays readable behind the focus.
 */
export function ThreadTrail() {
  const steps = useThreadStore((s) => s.steps)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const trailRef = useRef<THREE.Points>(null)
  const markerRef = useRef<THREE.Points>(null)

  const trail = useMemo(() => ({ positions: new Float32Array(MAX_PARTICLES * 3), colors: new Float32Array(MAX_PARTICLES * 3) }), [])
  const markers = useMemo(
    () => ({ positions: new Float32Array(THREAD_MAX_STEPS * 3), colors: new Float32Array(THREAD_MAX_STEPS * 3) }),
    [],
  )

  useFrame((state) => {
    const t = reducedMotion ? 0 : state.clock.elapsedTime * SPEED
    const where = steps.map((step) => drawnPosition(step.id) ?? step.position)
    const count = steps.length

    // Lights on the steps (the current focus already shines on its own).
    for (let i = 0; i < THREAD_MAX_STEPS; i += 1) {
      const o = i * 3
      const p = i < count - 1 ? where[i] : undefined
      if (!p) {
        markers.positions[o] = markers.positions[o + 1] = markers.positions[o + 2] = HIDDEN
        continue
      }
      const b = stepBrightness(i, count) * 0.75
      markers.positions[o] = p[0]
      markers.positions[o + 1] = p[1]
      markers.positions[o + 2] = p[2]
      markers.colors[o] = THREAD_COLOR.r * b
      markers.colors[o + 1] = THREAD_COLOR.g * b
      markers.colors[o + 2] = THREAD_COLOR.b * b
    }

    // Particles flowing along each stretch, older stretches dimmer.
    for (let s = 0; s < THREAD_MAX_STEPS - 1; s += 1) {
      const a = s < count - 1 ? where[s] : undefined
      const z = s < count - 1 ? where[s + 1] : undefined
      const b = stepBrightness(s + 1, count)
      for (let k = 0; k < PER_SEGMENT; k += 1) {
        const o = (s * PER_SEGMENT + k) * 3
        if (!a || !z) {
          trail.positions[o] = trail.positions[o + 1] = trail.positions[o + 2] = HIDDEN
          continue
        }
        const f = (t + k / PER_SEGMENT) % 1
        trail.positions[o] = a[0] + (z[0] - a[0]) * f
        trail.positions[o + 1] = a[1] + (z[1] - a[1]) * f
        trail.positions[o + 2] = a[2] + (z[2] - a[2]) * f
        // Brighter at the head of each stretch, so the flow reads as a direction.
        const glow = b * (0.35 + 0.65 * f)
        trail.colors[o] = THREAD_COLOR.r * glow
        trail.colors[o + 1] = THREAD_COLOR.g * glow
        trail.colors[o + 2] = THREAD_COLOR.b * glow
      }
    }

    for (const ref of [trailRef, markerRef]) {
      const geometry = ref.current?.geometry
      if (!geometry) continue
      ;(geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      ;(geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    }
  })

  if (steps.length < 1) return null

  return (
    <group>
      <points ref={trailRef} frustumCulled={false} renderOrder={2}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[trail.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[trail.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.42} sizeAttenuation vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <points ref={markerRef} frustumCulled={false} renderOrder={2}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[markers.positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[markers.colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={1.25} sizeAttenuation vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  )
}
