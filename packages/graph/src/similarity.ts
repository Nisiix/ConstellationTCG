/**
 * Relationships between expansions, and between a card and its counterparts in earlier ones.
 *
 * Pure and TCG agnostic: both graph builders (one shot and stepwise) gather the same input from
 * the catalog and call `similarityRelationships`, so they write exactly the same edges.
 *
 *   set → set              SHARED_SUBJECTS    the sets print the same Pokémon (the adapter's subject)
 *   set → set              SHARED_ARTISTS     the same artists illustrated both
 *   set → set              SIMILAR_STRUCTURE  alike in make-up: categories, stages, rarities, size
 *   printing → printing    COUNTERPART_OF     the same Pokémon in an earlier expansion that is
 *                                             structurally the closest to this one
 *
 * Set edges are undirected and stored once, from the newer set to the older. Each set keeps its
 * closest few per kind, so a set has a handful of neighbours, never all of them.
 */
import { makeNodeId, type GraphRelationship } from '@constellation/domain'
import { comparePrintings, NO_RELEASE } from './compose'

export interface SimilaritySet {
  id: string
  externalId: string
  releaseDate: string | null
}

export interface SimilarityPrinting {
  id: string
  setId: string
  identityId: string
  artistId: string | null
  category: string | null
  rarity: string | null
  /** Evolution stage or the game's equivalent (an attribute), when there is one. */
  stage: string | null
  collectorNumber: string
  externalId: string
  /** The printing's own release date (the set's stands in when absent). */
  releaseDate: string | null
}

export interface SimilarityInput {
  sets: SimilaritySet[]
  printings: SimilarityPrinting[]
  /**
   * What each card depicts (Pokémon: the species, from the adapter's subject relation). A game
   * without subjects passes the card's identity, so sets are compared by the cards they share.
   */
  subjects: Array<{ printingId: string; subjectId: string }>
}

export interface SimilarityOptions {
  /** Closest sets kept per set and per kind. */
  perSet?: number
  /** Earlier expansions a card looks for its counterparts in. */
  predecessors?: number
}

export const SET_NEIGHBOURS = 6
export const COUNTERPART_PREDECESSORS = 2

const MIN_SHARED_SUBJECTS = 2
const MIN_SHARED_ARTISTS = 2
const MIN_JACCARD = 0.05
/** Structure alone relates two sets only when they really look alike. */
const MIN_STRUCTURE = 0.6
const MIN_SET_SIZE = 3

interface Profile {
  set: SimilaritySet
  subjects: Set<string>
  artists: Set<string>
  /** Share of the set's cards per feature (`category:…`, `stage:…`, `rarity:…`). */
  structure: Map<string, number>
  norm: number
  size: number
}

type Kind = 'SHARED_SUBJECTS' | 'SHARED_ARTISTS' | 'SIMILAR_STRUCTURE'

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** Newest first: release date, then external id (both byte-wise, so the order is stable). */
function newerFirst(a: SimilaritySet, b: SimilaritySet): number {
  return compareText(b.releaseDate ?? NO_RELEASE, a.releaseDate ?? NO_RELEASE) || compareText(b.externalId, a.externalId)
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function intersection(a: Set<string>, b: Set<string>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let n = 0
  for (const v of small) if (large.has(v)) n += 1
  return n
}

function jaccard(a: Set<string>, b: Set<string>): { shared: number; score: number } {
  const shared = intersection(a, b)
  const union = a.size + b.size - shared
  return { shared, score: union === 0 ? 0 : shared / union }
}

/** Cosine of the feature shares, damped by the size ratio (a 30-card promo set is not a 200-card expansion). */
function structureScore(a: Profile, b: Profile): number {
  if (a.size < MIN_SET_SIZE || b.size < MIN_SET_SIZE || a.norm === 0 || b.norm === 0) return 0
  let dot = 0
  for (const [feature, share] of a.structure) dot += share * (b.structure.get(feature) ?? 0)
  return (dot / (a.norm * b.norm)) * Math.sqrt(Math.min(a.size, b.size) / Math.max(a.size, b.size))
}

function profiles(input: SimilarityInput): Map<string, Profile> {
  const out = new Map<string, Profile>()
  for (const set of input.sets) {
    out.set(set.id, { set, subjects: new Set(), artists: new Set(), structure: new Map(), norm: 0, size: 0 })
  }
  const setOfPrinting = new Map<string, string>()
  for (const p of input.printings) {
    const profile = out.get(p.setId)
    if (!profile) continue
    setOfPrinting.set(p.id, p.setId)
    profile.size += 1
    if (p.artistId) profile.artists.add(p.artistId)
    for (const feature of [p.category && `category:${p.category}`, p.stage && `stage:${p.stage}`, p.rarity && `rarity:${p.rarity}`]) {
      if (feature) profile.structure.set(feature, (profile.structure.get(feature) ?? 0) + 1)
    }
  }
  for (const link of input.subjects) {
    const setId = setOfPrinting.get(link.printingId)
    if (setId) out.get(setId)?.subjects.add(link.subjectId)
  }
  for (const profile of out.values()) {
    let sum = 0
    for (const [feature, count] of profile.structure) {
      const share = count / Math.max(1, profile.size)
      profile.structure.set(feature, share)
      sum += share * share
    }
    profile.norm = Math.sqrt(sum)
  }
  return out
}

interface Candidate {
  other: Profile
  score: number
  shared: number
}

function score(kind: Kind, a: Profile, b: Profile): Candidate | null {
  if (kind === 'SIMILAR_STRUCTURE') {
    const s = structureScore(a, b)
    return s >= MIN_STRUCTURE ? { other: b, score: s, shared: 0 } : null
  }
  const [mine, theirs, minimum] = kind === 'SHARED_SUBJECTS' ? [a.subjects, b.subjects, MIN_SHARED_SUBJECTS] : [a.artists, b.artists, MIN_SHARED_ARTISTS]
  const { shared, score: s } = jaccard(mine, theirs)
  return shared >= minimum && s >= MIN_JACCARD ? { other: b, score: s, shared } : null
}

/** Strongest first; ties go to the closer release, then the id, so the choice never depends on input order. */
function byCloseness(of: Profile) {
  const day = (p: Profile) => Date.parse(p.set.releaseDate ?? '') || 0
  return (x: Candidate, y: Candidate) =>
    y.score - x.score ||
    Math.abs(day(x.other) - day(of)) - Math.abs(day(y.other) - day(of)) ||
    compareText(x.other.set.id, y.other.set.id)
}

function setRelationships(all: Profile[], perSet: number): GraphRelationship[] {
  const out: GraphRelationship[] = []
  for (const kind of ['SHARED_SUBJECTS', 'SHARED_ARTISTS', 'SIMILAR_STRUCTURE'] as const) {
    const chosen = new Map<string, { a: Profile; b: Profile; score: number; shared: number }>()
    for (const profile of all) {
      const candidates: Candidate[] = []
      for (const other of all) {
        if (other === profile) continue
        const candidate = score(kind, profile, other)
        if (candidate) candidates.push(candidate)
      }
      candidates.sort(byCloseness(profile))
      for (const c of candidates.slice(0, perSet)) {
        const [newer, older] = newerFirst(profile.set, c.other.set) <= 0 ? [profile, c.other] : [c.other, profile]
        chosen.set(`${newer.set.id}|${older.set.id}`, { a: newer, b: older, score: c.score, shared: c.shared })
      }
    }
    for (const { a, b, score: s, shared } of chosen.values()) {
      out.push({
        sourceNodeId: makeNodeId('set', a.set.id),
        targetNodeId: makeNodeId('set', b.set.id),
        relationshipType: kind,
        weight: round(0.35 + 0.5 * s),
        direction: 'undirected',
        metadata: kind === 'SIMILAR_STRUCTURE' ? { score: round(s) } : { score: round(s), shared },
      })
    }
  }
  return out
}

function counterpartRelationships(input: SimilarityInput, all: Map<string, Profile>, predecessors: number): GraphRelationship[] {
  const subjectsOf = new Map<string, Set<string>>()
  for (const link of input.subjects) {
    const set = subjectsOf.get(link.printingId) ?? new Set<string>()
    set.add(link.subjectId)
    subjectsOf.set(link.printingId, set)
  }
  // Per set: subject → its printings, in printing order (the first is the one a counterpart points at).
  const order = (p: SimilarityPrinting) => ({
    releaseDate: p.releaseDate ?? all.get(p.setId)?.set.releaseDate ?? null,
    collectorNumber: p.collectorNumber,
    externalId: p.externalId,
  })
  const sorted = [...input.printings].sort((a, b) => comparePrintings(order(a), order(b)))
  const bySetSubject = new Map<string, Map<string, SimilarityPrinting[]>>()
  for (const p of sorted) {
    const subjects = subjectsOf.get(p.id)
    if (!subjects) continue
    const index = bySetSubject.get(p.setId) ?? new Map<string, SimilarityPrinting[]>()
    for (const subject of subjects) index.set(subject, [...(index.get(subject) ?? []), p])
    bySetSubject.set(p.setId, index)
  }

  // Each set's closest earlier expansions: half make-up, half Pokémon in common.
  const earlier = new Map<string, Profile[]>()
  const profilesList = [...all.values()]
  for (const profile of profilesList) {
    const date = profile.set.releaseDate
    if (!date) continue
    const candidates: Candidate[] = []
    for (const other of profilesList) {
      if (!other.set.releaseDate || other.set.releaseDate >= date) continue
      const { shared, score: s } = jaccard(profile.subjects, other.subjects)
      if (shared === 0) continue
      candidates.push({ other, score: 0.5 * structureScore(profile, other) + 0.5 * s, shared })
    }
    candidates.sort(byCloseness(profile))
    earlier.set(profile.set.id, candidates.slice(0, predecessors).map((c) => c.other))
  }

  const out: GraphRelationship[] = []
  for (const p of sorted) {
    const subjects = subjectsOf.get(p.id)
    if (!subjects) continue
    for (const predecessor of earlier.get(p.setId) ?? []) {
      const index = bySetSubject.get(predecessor.set.id)
      if (!index) continue
      // The predecessor's card of the same Pokémon (not a reprint of this very card), preferring one
      // that shows exactly the same Pokémon, then the first in printing order.
      let best: { printing: SimilarityPrinting; exact: boolean } | null = null
      for (const subject of [...subjects].sort(compareText)) {
        for (const candidate of index.get(subject) ?? []) {
          if (candidate.identityId === p.identityId) continue
          const theirs = subjectsOf.get(candidate.id)
          const exact = theirs !== undefined && theirs.size === subjects.size && [...subjects].every((s) => theirs.has(s))
          if (!best || (exact && !best.exact)) best = { printing: candidate, exact }
          break
        }
      }
      if (!best) continue
      out.push({
        sourceNodeId: makeNodeId('card_printing', p.id),
        targetNodeId: makeNodeId('card_printing', best.printing.id),
        relationshipType: 'COUNTERPART_OF',
        weight: 0.75,
        direction: 'directed',
        metadata: {},
      })
    }
  }
  return out
}

export function similarityRelationships(input: SimilarityInput, options: SimilarityOptions = {}): GraphRelationship[] {
  const all = profiles(input)
  const ordered = [...all.values()].sort((a, b) => compareText(a.set.id, b.set.id))
  return [
    ...setRelationships(ordered, options.perSet ?? SET_NEIGHBOURS),
    ...counterpartRelationships(input, all, options.predecessors ?? COUNTERPART_PREDECESSORS),
  ]
}
