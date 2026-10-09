import { describe, expect, it } from 'vitest'
import { similarityRelationships, type SimilarityInput, type SimilarityPrinting } from '../similarity'

/** A tiny catalog: an original set, its near-twin reprint set, a later set of the same era and an unrelated one. */
function catalog(): SimilarityInput {
  const sets = [
    { id: 'A', externalId: 'a', releaseDate: '1999-01-09' },
    { id: 'B', externalId: 'b', releaseDate: '2000-02-24' },
    { id: 'C', externalId: 'c', releaseDate: '2001-06-01' },
    { id: 'Z', externalId: 'z', releaseDate: '2020-01-01' },
  ]
  const printings: SimilarityPrinting[] = []
  const subjects: SimilarityInput['subjects'] = []
  let n = 0
  const card = (setId: string, identityId: string, subject: string | null, artistId: string, stage: string, rarity: string) => {
    n += 1
    const p: SimilarityPrinting = {
      id: `${setId}${n}`,
      setId,
      identityId,
      artistId,
      category: 'Pokemon',
      rarity,
      stage,
      collectorNumber: String(n),
      externalId: `${setId.toLowerCase()}-${n}`,
      releaseDate: null,
    }
    printings.push(p)
    if (subject) subjects.push({ printingId: p.id, subjectId: subject })
    return p
  }
  // Set A: the original.
  for (const [i, s] of ['charmander', 'charmeleon', 'charizard', 'pikachu', 'bulbasaur', 'squirtle'].entries()) {
    card('A', `id-${s}`, s, i % 2 ? 'arita' : 'sugimori', i % 3 === 0 ? 'Basic' : 'Stage1', i < 2 ? 'Rare' : 'Common')
  }
  // Set B: the same Pokémon and artists, other cards of them (a new Charizard card, etc.).
  for (const [i, s] of ['charmander', 'charmeleon', 'charizard', 'pikachu', 'bulbasaur', 'squirtle'].entries()) {
    card('B', `id-${s}-b`, s, i % 2 ? 'arita' : 'sugimori', i % 3 === 0 ? 'Basic' : 'Stage1', i < 2 ? 'Rare' : 'Common')
  }
  // Set C: half the Pokémon, one artist in common.
  for (const [i, s] of ['charizard', 'pikachu', 'mew', 'eevee', 'snorlax', 'ditto'].entries()) {
    card('C', `id-${s}-c`, s, i === 0 ? 'arita' : 'kato', i % 3 === 0 ? 'Basic' : 'Stage1', i < 2 ? 'Rare' : 'Common')
  }
  // Set Z: nothing in common, a different structure.
  for (const s of ['sprigatito', 'fuecoco', 'quaxly', 'lechonk', 'tinkatink', 'wiglett']) {
    card('Z', `id-${s}`, s, 'saito', 'Stage2', 'Double rare')
  }
  // A trainer in B with no Pokémon: no subject, no counterpart.
  card('B', 'id-bill', null, 'sugimori', 'Basic', 'Common')
  return { sets, printings, subjects }
}

const edgesOf = (input: SimilarityInput) => similarityRelationships(input)

describe('set similarity', () => {
  it('relates sets that share Pokémon, artists and structure, newer to older, undirected', () => {
    const rels = edgesOf(catalog())
    const pair = (type: string, a: string, b: string) =>
      rels.find((r) => r.relationshipType === type && r.sourceNodeId === `set:${a}` && r.targetNodeId === `set:${b}`)
    const shared = pair('SHARED_SUBJECTS', 'B', 'A')
    expect(shared?.direction).toBe('undirected')
    expect(shared?.metadata).toMatchObject({ shared: 6 })
    expect(pair('SHARED_SUBJECTS', 'C', 'A')?.metadata).toMatchObject({ shared: 2 })
    expect(pair('SHARED_ARTISTS', 'B', 'A')?.metadata).toMatchObject({ shared: 2 })
    expect(pair('SIMILAR_STRUCTURE', 'B', 'A')).toBeDefined()
    // A twin set is closer than a half-related one.
    expect((pair('SHARED_SUBJECTS', 'B', 'A')?.weight ?? 0) > (pair('SHARED_SUBJECTS', 'C', 'A')?.weight ?? 1)).toBe(true)
  })

  it('does not relate sets that have nothing in common', () => {
    const rels = edgesOf(catalog())
    const touchesZ = rels.filter((r) => r.sourceNodeId === 'set:Z' || r.targetNodeId === 'set:Z')
    expect(touchesZ.filter((r) => r.relationshipType !== 'SIMILAR_STRUCTURE')).toEqual([])
    // Structure alone needs a real resemblance: Z's Stage 2 double rares look like nothing else here.
    expect(touchesZ).toEqual([])
  })

  it('stores each pair once per kind and is deterministic', () => {
    const rels = edgesOf(catalog())
    const ids = rels.map((r) => `${r.sourceNodeId}|${r.relationshipType}|${r.targetNodeId}`)
    expect(new Set(ids).size).toBe(ids.length)
    const reversed = catalog()
    reversed.sets.reverse()
    reversed.printings.reverse()
    reversed.subjects.reverse()
    expect(edgesOf(reversed).map((r) => `${r.sourceNodeId}|${r.relationshipType}|${r.targetNodeId}|${r.weight}`).sort()).toEqual(
      rels.map((r) => `${r.sourceNodeId}|${r.relationshipType}|${r.targetNodeId}|${r.weight}`).sort(),
    )
  })

  it('keeps at most the closest sets per kind', () => {
    const input = catalog()
    const many = similarityRelationships(input, { perSet: 1 })
    for (const type of ['SHARED_SUBJECTS', 'SHARED_ARTISTS', 'SIMILAR_STRUCTURE']) {
      // A pair stays when it is the closest for either of its sets: each set picks at most one.
      expect(many.filter((r) => r.relationshipType === type).length).toBeLessThanOrEqual(input.sets.length)
    }
  })
})

describe('counterparts in earlier similar sets', () => {
  it("links a card to the same Pokémon's card in the earlier, most similar expansions", () => {
    const rels = edgesOf(catalog()).filter((r) => r.relationshipType === 'COUNTERPART_OF')
    const of = (id: string) => rels.filter((r) => r.sourceNodeId === `card_printing:${id}`).map((r) => r.targetNodeId)
    // B's Charizard (B9) → A's Charizard (A3).
    expect(of('B9')).toEqual(['card_printing:A3'])
    // C's Charizard (C13) → B's and A's Charizard: two predecessors at most.
    expect(of('C13').sort()).toEqual(['card_printing:A3', 'card_printing:B9'])
    // Pokémon the earlier sets never printed (C's Mew) have no counterpart; nor does the oldest set.
    expect(of('C15')).toEqual([])
    expect(rels.some((r) => r.sourceNodeId.startsWith('card_printing:A'))).toBe(false)
    // Only later → earlier, directed.
    expect(rels.every((r) => r.direction === 'directed')).toBe(true)
  })

  it('never pairs a card with a reprint of itself (that is a reprint, not a counterpart) nor a card without a subject', () => {
    const input = catalog()
    // Make B's Charizard the very same card as A's.
    const b9 = input.printings.find((p) => p.id === 'B9')
    if (!b9) throw new Error('fixture')
    b9.identityId = 'id-charizard'
    const rels = edgesOf(input).filter((r) => r.relationshipType === 'COUNTERPART_OF')
    expect(rels.some((r) => r.sourceNodeId === 'card_printing:B9' && r.targetNodeId === 'card_printing:A3')).toBe(false)
    expect(rels.some((r) => r.sourceNodeId === 'card_printing:B25')).toBe(false)
  })
})
