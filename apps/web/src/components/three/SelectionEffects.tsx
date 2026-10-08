'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { nodeRadius } from '@/lib/colors'
import { useTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { animatedPositions, easeOutCubic, revealClock } from './animated'

/** A soft radial halo. Dark mode: bright core adding light. Light mode: a tinted, fading disc. */
function useHaloTexture(color: string, dark: boolean): THREE.Texture | null {
  return useMemo(() => {
    if (typeof document === 'undefined') return null
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const c = new THREE.Color(color)
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    if (dark) {
      gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
      gradient.addColorStop(0.18, `rgba(${rgb},0.6)`)
      gradient.addColorStop(0.45, `rgba(${rgb},0.2)`)
    } else {
      gradient.addColorStop(0, `rgba(${rgb},0.55)`)
      gradient.addColorStop(0.3, `rgba(${rgb},0.22)`)
      gradient.addColorStop(0.6, `rgba(${rgb},0.06)`)
    }
    gradient.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }, [color, dark])
}

/**
 * Focus effects: a soft halo, and a slowly spinning two-tone orbit ring — primary color on top,
 * contrast color below, separated by thin gaps in the background color (a Pokéball seen from
 * above in the Pokémon theme, in contours only). Hovered nodes get a smaller halo.
 */
export function SelectionEffects() {
  const theme = useTheme()
  const dark = theme.mode === 'dark'
  const texture = useHaloTexture(theme.primary, dark)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const distances = useGraphStore((s) => s.distances)
  const nodes = useGraphStore((s) => s.nodes)
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const camera = useThree((s) => s.camera)
  const focusHalo = useRef<THREE.Sprite>(null)
  const hoverHalo = useRef<THREE.Sprite>(null)
  const ring = useRef<THREE.Group>(null)
  const pulseRing = useRef<THREE.Mesh>(null)
  const blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const elapsed = (performance.now() - revealClock.startedAt) / 1000
    const reveal = reducedMotion ? 1 : easeOutCubic(elapsed / 0.5)
    const focusPos = focusNodeId ? animatedPositions.get(focusNodeId) : undefined
    if (focusHalo.current) {
      if (focusPos) {
        focusHalo.current.visible = true
        focusHalo.current.position.set(focusPos[0], focusPos[1], focusPos[2])
        focusHalo.current.scale.setScalar((7.5 + Math.sin(t * 1.6) * 0.5) * reveal)
      } else focusHalo.current.visible = false
    }
    if (ring.current) {
      if (focusPos) {
        ring.current.visible = true
        ring.current.position.set(focusPos[0], focusPos[1], focusPos[2])
        ring.current.quaternion.copy(camera.quaternion)
        ring.current.rotateZ(reducedMotion ? 0 : t * 0.35)
        ring.current.scale.setScalar(reveal)
      } else ring.current.visible = false
    }
    if (pulseRing.current) {
      if (focusPos && !reducedMotion) {
        pulseRing.current.visible = true
        pulseRing.current.position.set(focusPos[0], focusPos[1], focusPos[2])
        pulseRing.current.quaternion.copy(camera.quaternion)
        const phase = (t * 0.55) % 1
        pulseRing.current.scale.setScalar((1 + phase * 0.9) * reveal)
        ;(pulseRing.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - phase)
      } else pulseRing.current.visible = false
    }
    if (hoverHalo.current) {
      const hoverPos = hoveredNodeId && hoveredNodeId !== focusNodeId ? animatedPositions.get(hoveredNodeId) : undefined
      if (hoverPos && hoveredNodeId) {
        const node = nodes.find((n) => n.id === hoveredNodeId)
        const radius = node ? nodeRadius(node.nodeType, distances[node.id] ?? 1, false) : 0.8
        hoverHalo.current.visible = true
        hoverHalo.current.position.set(hoverPos[0], hoverPos[1], hoverPos[2])
        hoverHalo.current.scale.setScalar(radius * 5)
      } else hoverHalo.current.visible = false
    }
  })

  if (!texture) return null

  return (
    <group key={`${theme.id}-${theme.mode}`}>
      <sprite ref={focusHalo} visible={false}>
        <spriteMaterial map={texture} transparent depthWrite={false} blending={blending} opacity={dark ? 0.8 : 0.9} toneMapped={false} />
      </sprite>
      <group ref={ring} visible={false}>
        {/* gap between the ring and the scene, in the background color */}
        <mesh position={[0, 0, -0.01]}>
          <ringGeometry args={[2.15, 2.85, 72]} />
          <meshBasicMaterial color={theme.background} transparent opacity={0.9} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* upper half: primary */}
        <mesh>
          <ringGeometry args={[2.3, 2.7, 48, 1, 0, Math.PI]} />
          <meshBasicMaterial color={theme.primary} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* lower half: contrast */}
        <mesh>
          <ringGeometry args={[2.3, 2.7, 48, 1, Math.PI, Math.PI]} />
          <meshBasicMaterial color={theme.contrast} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* the two "buttons" where the halves meet: background gap, contrast contour */}
        {[2.5, -2.5].map((x) => (
          <group key={x}>
            <mesh position={[x, 0, 0.01]}>
              <circleGeometry args={[0.3, 24]} />
              <meshBasicMaterial color={theme.background} depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[x, 0, 0.02]}>
              <ringGeometry args={[0.13, 0.2, 24]} />
              <meshBasicMaterial color={theme.contrast} depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
      <mesh ref={pulseRing} visible={false}>
        <ringGeometry args={[2.6, 2.72, 72]} />
        <meshBasicMaterial color={theme.primary} transparent opacity={0.4} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <sprite ref={hoverHalo} visible={false}>
        <spriteMaterial map={texture} transparent depthWrite={false} blending={blending} opacity={dark ? 0.6 : 0.75} toneMapped={false} />
      </sprite>
    </group>
  )
}
