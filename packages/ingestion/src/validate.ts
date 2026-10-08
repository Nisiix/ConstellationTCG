import { ValidationError, type NormalizedCard } from '@constellation/domain'
import { z } from 'zod'

const entityRefSchema = z.object({
  kind: z.enum(['pokemon', 'attribute', 'mechanic']),
  key: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  relation: z.string().min(1).max(64),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const normalizedCardSchema = z.object({
  externalId: z.string().min(1).max(100),
  setExternalId: z.string().min(1).max(100),
  language: z.string().min(2).max(8),
  name: z.string().min(1).max(300),
  identityEntityType: z.enum(['character', 'trainer', 'energy', 'item', 'other']),
  collectorNumber: z.string().min(1).max(40),
  printedNumber: z.string().max(80).nullable(),
  category: z.string().max(40).nullable(),
  rarity: z.string().max(80).nullable(),
  variant: z.string().min(1).max(40),
  finish: z.enum(['normal', 'holo', 'reverse', 'other']),
  artistName: z.string().min(1).max(200).nullable(),
  imageFront: z.url().nullable(),
  imageBack: z.url().nullable(),
  description: z.string().nullable(),
  attributes: z.record(z.string(), z.unknown()),
  entities: z.array(entityRefSchema),
  rawHash: z.string().regex(/^[0-9a-f]{64}$/),
})

/** Validate a normalized card. Throws ValidationError with the list of issues. */
export function validateNormalizedCard(card: NormalizedCard): NormalizedCard {
  const result = normalizedCardSchema.safeParse(card)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    throw new ValidationError(`Card ${card.externalId} failed validation: ${issues.join('; ')}`, {
      externalId: card.externalId,
      issues,
    })
  }
  return result.data as NormalizedCard
}
