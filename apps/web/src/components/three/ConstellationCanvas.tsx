'use client'

import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { useGraphStore } from '@/state/graph-store'
import { GraphScene } from './GraphScene'

export function ConstellationCanvas() {
  const select = useGraphStore((s) => s.select)

  return (
    <div className="absolute inset-0 z-0" aria-hidden>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 8, 44], fov: 55, near: 0.1, far: 500 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false }}
        onPointerMissed={() => select(null)}
        onCreated={({ gl }) => {
          // Prevent the default so the browser restores the context after a transient loss
          // (switching views unmounts the canvas and fires this event too).
          gl.domElement.addEventListener('webglcontextlost', (event) => event.preventDefault())
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
