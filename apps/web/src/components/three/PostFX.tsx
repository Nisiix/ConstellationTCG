'use client'

import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { useThemeMode } from '@/lib/theme'

/**
 * A soft glow on the bright contours (no neon) and a gentle vignette that keeps the eye centered.
 * Light mode gets much less of both: glow on a light background washes out, a dark vignette
 * looks dirty.
 */
export function PostFX() {
  const mode = useThemeMode()
  const dark = mode === 'dark'
  return (
    <EffectComposer key={mode} multisampling={0}>
      <Bloom
        intensity={dark ? 0.75 : 0.22}
        luminanceThreshold={dark ? 0.42 : 0.82}
        luminanceSmoothing={0.6}
        mipmapBlur
        radius={0.5}
      />
      <Vignette eskil={false} offset={dark ? 0.2 : 0.35} darkness={dark ? 0.6 : 0.18} />
    </EffectComposer>
  )
}
