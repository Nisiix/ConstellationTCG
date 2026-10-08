'use client'

import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

/** A soft glow on nodes and edges (no neon), and a gentle vignette that keeps the eye centered. */
export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.75} luminanceThreshold={0.42} luminanceSmoothing={0.6} mipmapBlur radius={0.5} />
      <Vignette eskil={false} offset={0.2} darkness={0.6} />
    </EffectComposer>
  )
}
