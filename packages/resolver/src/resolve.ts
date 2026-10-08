import { assetResolutionCandidates, eq, type Db } from '@constellation/database'
import type { AssetMatchSignals, ResolverResult } from '@constellation/domain'
import { findCandidates } from './candidates'
import { resolveAgainst, type ResolverOptions } from './score'

/** Resolve an asset's signals against the catalog. */
export async function resolveAsset(db: Db, signals: AssetMatchSignals, options: ResolverOptions = {}): Promise<ResolverResult> {
  const candidates = await findCandidates(db, signals)
  return resolveAgainst(signals, candidates, options)
}

/**
 * Persist a resolution for a stored digital asset: every candidate with its confidence, the
 * matched one flagged `resolved`, the rest `ambiguous` or `unresolved`. Re-running replaces the
 * previous candidates.
 */
export async function recordResolution(db: Db, assetId: string, result: ResolverResult): Promise<void> {
  await db.delete(assetResolutionCandidates).where(eq(assetResolutionCandidates.assetId, assetId))
  if (result.candidates.length === 0) return
  await db.insert(assetResolutionCandidates).values(
    result.candidates.map((c) => ({
      assetId,
      printingId: c.printingId,
      status: result.status === 'resolved' && c.printingId === result.printingId ? 'resolved' : result.status,
      confidence: c.confidence,
      reasons: c.reasons,
    })),
  )
}
