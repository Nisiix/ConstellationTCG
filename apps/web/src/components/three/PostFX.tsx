'use client'

import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'

/**
 * A soft glow on the bright contours (no neon) and a gentle vignette that keeps the eye centered.
 * The scene is always drawn on its dark sky, so one tuning serves both interface modes.
 */
export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.65} luminanceThreshold={0.45} luminanceSmoothing={0.6} mipmapBlur radius={0.5} />
      <Vignette eskil={false} offset={0.2} darkness={0.55} />
    </EffectComposer>
  )
}
