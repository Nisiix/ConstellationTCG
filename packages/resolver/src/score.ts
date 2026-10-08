/**
 * Scoring of a digital asset against candidate printings.
 *
 * Pure: no database. Every signal the asset carries (name, set, number, language, variant,
 * finish, edition, artist, external ids) contributes to a confidence in [0, 1]; an exact external
 * id from a known source is conclusive on its own. Below the threshold nothing is auto-matched:
 * the result is `ambiguous` (several plausible printings) or `unresolved`.
 */
import { collectorNumberFromPrinted, normalizeName, slugify, type AssetMatchSignals, type ResolverCandidate, type ResolverResult } from '@constellation/domain'

/** What the resolver needs to know about a printing to score it. */
export interface PrintingCandidate {
  printingId: string
  identityName: string
  setName: string
  setSlug: string
  setExternalId: string
  collectorNumber: string
  printedNumber: string | null
  language: string
  variant: string
  finish: string
  artistName: string | null
  /** Source → external id (e.g. `tcgdex` → `base1-4`). */
  externalIds: Record<string, string>
}

export interface ResolverOptions {
  /** Confidence at or above which the best candidate is auto-matched. */
  resolveThreshold?: number
  /** Minimum lead of the best candidate over the runner-up to be considered unambiguous. */
  minLead?: number
  /** Confidence at or above which the best candidate is at least a plausible match (`ambiguous`). */
  ambiguousThreshold?: number
  /** Confidence below which a candidate is not even listed. */
  candidateThreshold?: number
  /** Maximum candidates reported. */
  maxCandidates?: number
}

export const DEFAULT_RESOLVER_OPTIONS: Required<ResolverOptions> = {
  resolveThreshold: 0.85,
  minLead: 0.1,
  // A matching name alone (0.42) is a plausible match worth a human look, never an auto-match.
  ambiguousThreshold: 0.35,
  candidateThreshold: 0.3,
  maxCandidates: 5,
}

/** Weights of the matching signals. They sum to 1 when every signal matches. */
export const SIGNAL_WEIGHTS = {
  name: 0.42,
  set: 0.25,
  number: 0.2,
  language: 0.05,
  artist: 0.04,
  variant: 0.02,
  finish: 0.02,
} as const

function sameSet(signal: string, candidate: PrintingCandidate): boolean {
  const n = normalizeName(signal)
  return (
    n === normalizeName(candidate.setName) ||
    slugify(signal) === candidate.setSlug ||
    n === normalizeName(candidate.setExternalId)
  )
}

function sameNumber(signal: string, candidate: PrintingCandidate): boolean {
  const n = collectorNumberFromPrinted(signal).toLowerCase().replace(/^0+(?=\d)/, '')
  const c = candidate.collectorNumber.toLowerCase().replace(/^0+(?=\d)/, '')
  if (n === c) return true
  return candidate.printedNumber !== null && normalizeName(signal) === normalizeName(candidate.printedNumber)
}

/** Score one candidate: confidence in [0, 1] and the reasons behind it. */
export function scoreCandidate(signals: AssetMatchSignals, candidate: PrintingCandidate): ResolverCandidate {
  const reasons: string[] = []
  // A known external id is conclusive.
  for (const [source, id] of Object.entries(signals.externalIds ?? {})) {
    const known = candidate.externalIds[source]
    if (known && known.toLowerCase() === id.toLowerCase()) {
      return { printingId: candidate.printingId, confidence: 1, reasons: [`external id ${source}:${id}`] }
    }
  }

  let confidence = 0
  if (signals.name) {
    const n = normalizeName(signals.name)
    const c = normalizeName(candidate.identityName)
    if (n === c) {
      confidence += SIGNAL_WEIGHTS.name
      reasons.push('name')
    } else if (n.includes(c) || c.includes(n)) {
      // "Charizard Base Set" or "Charizard (holo)" still names the card.
      confidence += SIGNAL_WEIGHTS.name * 0.6
      reasons.push('name (partial)')
    } else {
      // A different name is disqualifying: nothing else can make up for it.
      return { printingId: candidate.printingId, confidence: 0, reasons: ['name mismatch'] }
    }
  }
  if (signals.set && sameSet(signals.set, candidate)) {
    confidence += SIGNAL_WEIGHTS.set
    reasons.push('set')
  }
  if (signals.cardNumber && sameNumber(signals.cardNumber, candidate)) {
    confidence += SIGNAL_WEIGHTS.number
    reasons.push('number')
  }
  if (signals.language && signals.language.toLowerCase() === candidate.language.toLowerCase()) {
    confidence += SIGNAL_WEIGHTS.language
    reasons.push('language')
  }
  if (signals.artist && candidate.artistName && normalizeName(signals.artist) === normalizeName(candidate.artistName)) {
    confidence += SIGNAL_WEIGHTS.artist
    reasons.push('artist')
  }
  if (signals.variant && normalizeName(signals.variant) === normalizeName(candidate.variant)) {
    confidence += SIGNAL_WEIGHTS.variant
    reasons.push('variant')
  }
  if (signals.finish && normalizeName(signals.finish) === normalizeName(candidate.finish)) {
    confidence += SIGNAL_WEIGHTS.finish
    reasons.push('finish')
  }
  return { printingId: candidate.printingId, confidence: Math.min(1, Number(confidence.toFixed(4))), reasons }
}

/** Score every candidate and decide: resolved, ambiguous or unresolved. */
export function resolveAgainst(
  signals: AssetMatchSignals,
  candidates: PrintingCandidate[],
  options: ResolverOptions = {},
): ResolverResult {
  const opts = { ...DEFAULT_RESOLVER_OPTIONS, ...options }
  const scored = candidates
    .map((c) => scoreCandidate(signals, c))
    .filter((c) => c.confidence >= opts.candidateThreshold)
    .sort((a, b) => b.confidence - a.confidence || a.printingId.localeCompare(b.printingId))
    .slice(0, opts.maxCandidates)
  const best = scored[0]
  if (!best) return { status: 'unresolved', confidence: 0, candidates: [] }
  const second = scored[1]
  const lead = best.confidence - (second?.confidence ?? 0)
  if (best.confidence >= opts.resolveThreshold && lead >= opts.minLead) {
    return { status: 'resolved', confidence: best.confidence, printingId: best.printingId, candidates: scored }
  }
  if (best.confidence >= opts.ambiguousThreshold) return { status: 'ambiguous', confidence: best.confidence, candidates: scored }
  return { status: 'unresolved', confidence: best.confidence, candidates: scored }
}
