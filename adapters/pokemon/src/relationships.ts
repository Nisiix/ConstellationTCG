import { normalizeName, type GraphRelationship, type RelationshipContext } from '@constellation/domain'

/** Edge weights drive layout proximity and neighbor ranking. Higher = closer / shown first. */
export const RELATIONSHIP_WEIGHTS: Record<string, number> = {
  BELONGS_TO: 1,
  PRINTING_OF: 1,
  SAME_POKEMON: 0.9,
  EVOLVES_FROM: 0.9,
  EVOLUTION_OF: 0.9,
  ILLUSTRATED_BY: 0.8,
}

/**
 * Entity links that become edges: only the Pokémon a card shows. Energy types, weaknesses,
 * resistances, attacks and abilities stay card data (and filters): two cards are not related
 * because both are Fire, nor because both sit in the same set.
 */
const ENTITY_RELATIONS = new Set(['SAME_POKEMON'])

/**
 * Relationships for one printing. Universal catalog edges (set → series → game, reprints, set
 * similarity, counterparts in earlier sets) are emitted by the core graph builder; this builder
 * adds everything the adapter knows:
 *
 *   printing → set            BELONGS_TO
 *   printing → identity       PRINTING_OF
 *   printing → artist         ILLUSTRATED_BY
 *   printing → pokemon        SAME_POKEMON
 *   printing → printing       EVOLVES_FROM   (the pre-evolution printed in the same set)
 *   printing → identity       EVOLVES_FROM   (when the set does not print the pre-evolution)
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
    const name = normalizeName(evolveFrom)
    const preIdentity = ctx.identityNodeIdByName(name)
    if (preIdentity && preIdentity !== printing.identityNodeId) {
      // The evolution line inside the expansion in hand comes first: Base Set's Charizard evolves
      // from Base Set's Charmeleon. Elsewhere, from the card in general.
      const inSet = (ctx.setPrintingNodeIdsByName?.(name) ?? []).filter((id) => id !== printing.nodeId)
      if (inSet.length > 0) for (const target of inSet) add(printing.nodeId, 'EVOLVES_FROM', target, { evolveFrom })
      else add(printing.nodeId, 'EVOLVES_FROM', preIdentity, { evolveFrom })
      add(printing.identityNodeId, 'EVOLUTION_OF', preIdentity, { evolveFrom })
    }
  }

  return out
}
