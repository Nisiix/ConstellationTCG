import {
  IdentityResolutionError,
  normalizeName,
  type IdentityResolution,
  type NormalizedCard,
} from '@constellation/domain'

/**
 * Identity resolution for Pokémon cards.
 *
 * Two printings share one identity when their names normalize to the same key and they are the
 * same kind of card. "Charizard" (Base Set) and "Charizard" (Evolutions) → one identity;
 * "Charizard ex" is a different identity; the species link lives on the `pokemon` entity.
 */
export function resolveIdentity(card: NormalizedCard): IdentityResolution {
  const normalizedName = normalizeName(card.name)
  if (!normalizedName) {
    throw new IdentityResolutionError(`Card ${card.externalId}: empty name`, {
      externalId: card.externalId,
    })
  }
  return {
    canonicalName: card.name.trim(),
    normalizedName,
    entityType: card.identityEntityType,
    description: card.description,
  }
}
