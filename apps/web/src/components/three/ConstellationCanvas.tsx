'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { GraphScene } from './GraphScene'

export function ConstellationCanvas() {
  const select = useGraphStore((s) => s.select)
  const setCapabilities = useUiStore((s) => s.setCapabilities)
  const reducedMotion = useUiStore((s) => s.reducedMotion)

  return (
    <div className="absolute inset-0 z-0" aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 8, 44], fov: 55, near: 0.1, far: 500 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }}
        onPointerMissed={() => select(null)}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', (event) => {
            event.preventDefault()
            setCapabilities({ reducedMotion, webgl: false })
          })
        }}
        frameloop="always"
      >
        <Suspense fallback={null}>
          <GraphScene />
        </Suspense>
      </Canvas>
    </div>
  )
}
