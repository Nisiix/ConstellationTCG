'use client'

import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

/** Bloom gives nodes and edges their glow; a soft vignette keeps the eye on the constellation. */
export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={1.1} luminanceThreshold={0.3} luminanceSmoothing={0.55} mipmapBlur radius={0.55} />
      <Vignette eskil={false} offset={0.22} darkness={0.7} />
    </EffectComposer>
  )
}
