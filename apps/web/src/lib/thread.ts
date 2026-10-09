import type { GraphNode, NodeType } from '@constellation/domain'
import type { Vec3 } from './layout'

/**
 * The thread: where a person has been in this session, in order. It lives in the browser tab only
 * (nothing is sent anywhere); what is shared is a path between two ends, recomputed on opening.
 */
export interface ThreadStep {
  id: string
  label: string
  nodeType: NodeType
  subtitle: string | null
  /** Where the point was last drawn in the sky (world coordinates; the layout is continuous). */
  position: Vec3 | null
}

/** Steps kept in the session; older ones drop off the far end. */
export const THREAD_MAX_STEPS = 60
/** Steps that stay fully lit; older ones fade. */
export const THREAD_LIT_STEPS = 12

/** Add the point in focus to the thread, unless it is already the last step. */
export function recordStep(steps: readonly ThreadStep[], node: GraphNode, position: Vec3 | null): ThreadStep[] {
  const last = steps.at(-1)
  if (last?.id === node.id) {
    if (!position || samePosition(last.position, position)) return steps as ThreadStep[]
    return [...steps.slice(0, -1), { ...last, position }]
  }
  const next = [...steps, { id: node.id, label: node.label, nodeType: node.nodeType, subtitle: node.subtitle, position }]
  return next.length > THREAD_MAX_STEPS ? next.slice(next.length - THREAD_MAX_STEPS) : next
}

/** Refresh the remembered position of every step that is in the sky right now. */
export function syncPositions(steps: readonly ThreadStep[], positions: ReadonlyMap<string, Vec3>): ThreadStep[] {
  let changed = false
  const next = steps.map((step) => {
    const position = positions.get(step.id)
    if (!position || samePosition(step.position, position)) return step
    changed = true
    return { ...step, position }
  })
  return changed ? next : (steps as ThreadStep[])
}

/**
 * How bright a step (and the stretch of thread leading to it) is: 1 for the last
 * `THREAD_LIT_STEPS`, then fading towards a faint floor so the whole journey stays readable.
 */
export function stepBrightness(index: number, count: number): number {
  const age = count - 1 - index
  if (age < THREAD_LIT_STEPS) return 1
  return Math.max(0.18, 1 - (age - THREAD_LIT_STEPS + 1) * 0.12)
}

function samePosition(a: Vec3 | null, b: Vec3): boolean {
  return Boolean(a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2])
}

/** Parse a stored thread defensively: anything unexpected yields an empty thread. */
export function parseStoredThread(raw: string | null): ThreadStep[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (s): s is ThreadStep =>
          Boolean(s) && typeof s === 'object' && typeof (s as ThreadStep).id === 'string' && typeof (s as ThreadStep).label === 'string',
      )
      .map((s) => ({
        id: s.id,
        label: s.label,
        nodeType: s.nodeType,
        subtitle: typeof s.subtitle === 'string' ? s.subtitle : null,
        position: Array.isArray(s.position) && s.position.length === 3 && s.position.every((n) => typeof n === 'number') ? s.position : null,
      }))
      .slice(-THREAD_MAX_STEPS)
  } catch {
    return []
  }
}
