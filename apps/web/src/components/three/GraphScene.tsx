'use client'

import { useSceneTheme } from '@/lib/theme'
import { CameraController } from './CameraController'
import { EdgeRenderer } from './EdgeRenderer'
import { EdgeSparks } from './EdgeSparks'
import { Labels } from './Labels'
import { NodeImages } from './NodeImages'
import { NodeRenderer } from './NodeRenderer'
import { ParticleField } from './ParticleField'
import { PostFX } from './PostFX'
import { SceneBoundary } from './SceneBoundary'
import { OwnershipEffects } from './OwnershipEffects'
import { SelectionEffects } from './SelectionEffects'
import { ThreadTrail } from './ThreadTrail'

/** The constellation. Always on the dark sky: the interface mode changes the panels, not the map. */
export function GraphScene() {
  const theme = useSceneTheme()
  return (
    <>
      <color attach="background" args={[theme.background]} />
      <fog attach="fog" args={[theme.background, 60, 220]} />
      <ambientLight intensity={0.8} />
      <ParticleField />
      <EdgeRenderer />
      <EdgeSparks />
      <ThreadTrail />
      <NodeRenderer />
      <NodeImages />
      <SelectionEffects />
      <OwnershipEffects />
      <SceneBoundary name="labels">
        <Labels />
      </SceneBoundary>
      <CameraController />
      <PostFX />
    </>
  )
}
