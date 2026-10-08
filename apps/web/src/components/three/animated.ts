import type { Vec3 } from '@/lib/layout'

/**
 * Animated (tweened) node positions shared between renderers inside one frame loop.
 * NodeRenderer advances them every frame towards the layout targets; edges, labels, halos and
 * the camera read from here so everything moves in lockstep.
 */
export const animatedPositions = new Map<string, Vec3>()

/**
 * Where and how big each point was actually drawn this frame (tween + idle drift + reveal,
 * hover and focus pulse). Images, labels, halos and edges read these so they stay centered on
 * the sphere they belong to. Written by NodeRenderer, which runs first in the frame loop.
 */
export const displayPositions = new Map<string, Vec3>()
export const displayScales = new Map<string, number>()

/** Timestamp (ms, performance.now) of the last neighborhood change — drives reveal animations. */
export const revealClock = { startedAt: 0, revision: -1 }

/** Frame-loop order: NodeRenderer first (it writes the display maps), everything else after. */
export const FRAME_PRIORITY_NODES = -1

export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - c, 3)
}

export function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}

/** Playful reveal: overshoots slightly before settling (ease-out-back). */
export function easeOutBack(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  const s = 1.4
  return 1 + (s + 1) * Math.pow(c - 1, 3) + s * Math.pow(c - 1, 2)
}

/** Frame-rate independent exponential smoothing factor. */
export function smoothing(delta: number, speed: number): number {
  return 1 - Math.exp(-speed * delta)
}

/** Position a point was drawn at (falls back to the tween target before the first frame). */
export function drawnPosition(id: string): Vec3 | undefined {
  return displayPositions.get(id) ?? animatedPositions.get(id)
}
