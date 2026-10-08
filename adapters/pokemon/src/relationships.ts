import { normalizeName, type GraphRelationship, type RelationshipContext } from '@constellation/domain'

/** Edge weights drive layout proximity and neighbor ranking. Higher = closer / shown first. */
export const RELATIONSHIP_WEIGHTS: Record<string, number> = {
  BELONGS_TO: 1,
  PRINTING_OF: 1,
  SAME_POKEMON: 0.9,
  EVOLVES_FROM: 0.9,
  EVOLUTION_OF: 0.9,
  ILLUSTRATED_BY: 0.8,
  HAS_TYPE: 0.5,
  HAS_ATTACK: 0.4,
  HAS_ABILITY: 0.4,
  HAS_ATTRIBUTE: 0.3,
  WEAK_TO: 0.3,
  RESISTS: 0.3,
}

const ENTITY_RELATIONS = new Set([
  'SAME_POKEMON',
  'HAS_TYPE',
  'WEAK_TO',
  'RESISTS',
  'HAS_ABILITY',
  'HAS_ATTACK',
  'HAS_ATTRIBUTE',
])

/**
 * Relationships for one printing. Universal catalog edges (set → series → game) are emitted by
 * the core graph builder; this builder adds everything the adapter knows:
 *
 *   printing → set            BELONGS_TO
 *   printing → identity       PRINTING_OF
 *   printing → artist         ILLUSTRATED_BY
 *   printing → pokemon        SAME_POKEMON
 *   printing → attribute      HAS_TYPE / WEAK_TO / RESISTS / HAS_ATTRIBUTE
 *   printing → mechanic       HAS_ABILITY / HAS_ATTACK
 *   printing → identity       EVOLVES_FROM   (the pre-evolution's identity)
 *   identity → identity       EVOLUTION_OF   (identity-level evolution line)
 */
export function buildRelationships(ctx: RelationshipContext): GraphRelationship[] {
  const { printing } = ctx
  const out: GraphRelationship[] = []
  const add = (
    sourceNodeId: string,
    relationshipType: string,
    targetNodeId: string,
    metadata?: Record<string, unknown>,
  ) => {
    out.push({
      sourceNodeId,
      targetNodeId,
      relationshipType,
      weight: RELATIONSHIP_WEIGHTS[relationshipType] ?? 0.5,
      direction: 'directed',
      metadata: metadata ?? {},
    })
  }

  add(printing.nodeId, 'BELONGS_TO', printing.setNodeId)
  add(printing.nodeId, 'PRINTING_OF', printing.identityNodeId)
  if (printing.artistNodeId) add(printing.nodeId, 'ILLUSTRATED_BY', printing.artistNodeId)

  for (const entity of ctx.entities) {
    if (!ENTITY_RELATIONS.has(entity.relation)) continue
    add(printing.nodeId, entity.relation, entity.nodeId, entity.metadata)
  }

  const evolveFrom = printing.attributes.evolveFrom
  if (typeof evolveFrom === 'string' && evolveFrom.trim()) {
    const preIdentity = ctx.identityNodeIdByName(normalizeName(evolveFrom))
    if (preIdentity && preIdentity !== printing.identityNodeId) {
      add(printing.nodeId, 'EVOLVES_FROM', preIdentity, { evolveFrom })
      add(printing.identityNodeId, 'EVOLUTION_OF', preIdentity, { evolveFrom })
    }
  }

  return out
}
