'use client'

import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { createRandom } from '@/lib/layout'
import { useTheme } from '@/lib/theme'
import { useUiStore } from '@/state/ui-store'

const COUNT = 2200

/** A slowly drifting field of faint stars in the theme's particle tint. */
export function ParticleField() {
  const theme = useTheme()
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const ref = useRef<THREE.Points>(null)
  const dark = theme.mode === 'dark'
  const positions = useMemo(() => {
    const random = createRandom(1337)
    const arr = new Float32Array(COUNT * 3)
    for (let i = 0; i < COUNT; i += 1) {
      const r = 50 + random() * 200
      const u = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      arr[i * 3] = r * s * Math.cos(theta)
      arr[i * 3 + 1] = r * s * Math.sin(theta)
      arr[i * 3 + 2] = r * u
    }
    return arr
  }, [])

  useFrame((state, delta) => {
    if (!ref.current || reducedMotion) return
    ref.current.rotation.y += delta * 0.006
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.05
  })

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        key={theme.mode}
        size={0.42}
        sizeAttenuation
        color={theme.particles}
        transparent
        opacity={dark ? 0.55 : 0.8}
        depthWrite={false}
        blending={dark ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  )
}
