'use client'

import { useTheme } from '@/lib/theme'
import { CameraController } from './CameraController'
import { CardSprites } from './CardSprites'
import { EdgeRenderer } from './EdgeRenderer'
import { EdgeSparks } from './EdgeSparks'
import { Labels } from './Labels'
import { NodeRenderer } from './NodeRenderer'
import { ParticleField } from './ParticleField'
import { PostFX } from './PostFX'
import { SelectionEffects } from './SelectionEffects'

export function GraphScene() {
  const theme = useTheme()
  return (
    <>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.background, 60, 220]} />
      <ambientLight intensity={0.8} />
      <ParticleField />
      <EdgeRenderer />
      <EdgeSparks />
      <NodeRenderer />
      <SelectionEffects />
      <Labels />
      <CardSprites />
      <CameraController />
      <PostFX />
    </>
  )
}
