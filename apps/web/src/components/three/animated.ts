import type { Vec3 } from '@/lib/layout'

/**
 * Animated (tweened) node positions shared between renderers inside one frame loop.
 * NodeRenderer advances them every frame towards the layout targets; edges, labels, halos and
 * the camera read from here so everything moves in lockstep.
 */
export const animatedPositions = new Map<string, Vec3>()

/** Timestamp (ms, performance.now) of the last neighborhood change — drives reveal animations. */
export const revealClock = { startedAt: 0, revision: -1 }

export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return 1 - Math.pow(1 - c, 3)
}

export function easeInOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t))
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}

/** Frame-rate independent exponential smoothing factor. */
export function smoothing(delta: number, speed: number): number {
  return 1 - Math.exp(-speed * delta)
}
