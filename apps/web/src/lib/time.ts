import type { GraphEdge, GraphNode } from '@constellation/domain'

/**
 * The sky in time: every point has a year (its release, or the first printing of a card), and the
 * time cursor shows the sky as it stood at the end of a year. Points without a date of their own
 * (an artist, a Pokémon) arrive with the first dated point they are connected to on screen; points
 * with no dated connection at all are timeless and always shown. The focus is always shown.
 */

export function yearOfDate(value: unknown): number | null {
  if (typeof value !== 'string' || value.length < 4) return null
  const year = Number(value.slice(0, 4))
  return Number.isInteger(year) && year > 0 && year < 9999 ? year : null
}

/** A point's own year: its release date, else its first release. */
export function ownYear(node: GraphNode): number | null {
  return yearOfDate(node.metadata.releaseDate) ?? yearOfDate(node.metadata.firstReleaseDate)
}

/** Every point's year on screen (own, else the earliest of its dated connections); timeless ones are absent. */
export function yearsOf(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const years = new Map<string, number>()
  for (const node of nodes) {
    const year = ownYear(node)
    if (year !== null) years.set(node.id, year)
  }
  const inherited = new Map<string, number>()
  for (const e of edges) {
    const s = years.get(e.sourceNodeId)
    const t = years.get(e.targetNodeId)
    if (s !== undefined && t === undefined) inherited.set(e.targetNodeId, Math.min(inherited.get(e.targetNodeId) ?? s, s))
    if (t !== undefined && s === undefined) inherited.set(e.sourceNodeId, Math.min(inherited.get(e.sourceNodeId) ?? t, t))
  }
  for (const [id, year] of inherited) years.set(id, year)
  return years
}

/** The years in which something on screen appeared, oldest first. */
export function timeSteps(years: Map<string, number>): number[] {
  return [...new Set(years.values())].sort((a, b) => a - b)
}

export interface TimeVisibility {
  /** Points not yet in the sky at the cursor. */
  hidden: Set<string>
  /** Points that appeared in the cursor's year. */
  fresh: Set<string>
}

export const NO_TIME: TimeVisibility = { hidden: new Set(), fresh: new Set() }

export function visibilityAt(years: Map<string, number>, year: number | null, focusId: string | null): TimeVisibility {
  if (year === null) return NO_TIME
  const hidden = new Set<string>()
  const fresh = new Set<string>()
  for (const [id, y] of years) {
    if (id === focusId) continue
    if (y > year) hidden.add(id)
    else if (y === year) fresh.add(id)
  }
  return { hidden, fresh }
}

/** The next year of the cursor when playing (null past the end); from "all of time", the first year. */
export function nextStep(steps: number[], year: number | null): number | null {
  if (steps.length === 0) return null
  if (year === null) return steps[0] ?? null
  return steps.find((y) => y > year) ?? null
}

export function previousStep(steps: number[], year: number | null): number | null {
  if (steps.length === 0) return null
  if (year === null) return steps.at(-1) ?? null
  return [...steps].reverse().find((y) => y < year) ?? null
}
