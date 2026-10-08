import { describe, expect, it } from 'vitest'
import { resolveAgainst, scoreCandidate, type PrintingCandidate } from '../score'

const base: PrintingCandidate = {
  printingId: 'base1-4',
  identityName: 'Charizard',
  setName: 'Base Set',
  setSlug: 'base-set',
  setExternalId: 'base1',
  collectorNumber: '4',
  printedNumber: '4/102',
  language: 'en',
  variant: 'standard',
  finish: 'holo',
  artistName: 'Mitsuhiro Arita',
  externalIds: { tcgdex: 'base1-4' },
}
const evolutions: PrintingCandidate = { ...base, printingId: 'xy12-11', setName: 'Evolutions', setSlug: 'evolutions', setExternalId: 'xy12', collectorNumber: '11', printedNumber: '11/108', externalIds: { tcgdex: 'xy12-11' } }
const charmeleon: PrintingCandidate = { ...base, printingId: 'base1-24', identityName: 'Charmeleon', collectorNumber: '24', printedNumber: '24/102', externalIds: { tcgdex: 'base1-24' } }

describe('resolver scoring', () => {
  it('resolves name + set + number (+ language) with high confidence', () => {
    const result = resolveAgainst({ name: 'Charizard', set: 'Base Set', cardNumber: '4', language: 'en' }, [base, evolutions, charmeleon])
    expect(result.status).toBe('resolved')
    expect(result.status === 'resolved' && result.printingId).toBe('base1-4')
    expect(result.confidence).toBeGreaterThanOrEqual(0.85)
    expect(result.candidates[0]?.reasons).toEqual(['name', 'set', 'number', 'language'])
  })

  it('is ambiguous on a name alone when several printings share it', () => {
    const result = resolveAgainst({ name: 'Charizard' }, [base, evolutions])
    expect(result.status).toBe('ambiguous')
    expect(result.candidates).toHaveLength(2)
  })

  it('never auto-matches a name alone, even with a single candidate', () => {
    const result = resolveAgainst({ name: 'Charizard' }, [base])
    expect(result.status).not.toBe('resolved')
    expect(result.confidence).toBeLessThan(0.85)
  })

  it('accepts printed numbers, zero-padded numbers and set slugs', () => {
    expect(scoreCandidate({ name: 'Charizard', set: 'base-set', cardNumber: '004/102' }, base).reasons).toEqual(['name', 'set', 'number'])
    expect(scoreCandidate({ name: 'Charizard', set: 'base1', cardNumber: '4/102' }, base).reasons).toEqual(['name', 'set', 'number'])
  })

  it('treats a known external id as conclusive', () => {
    const result = resolveAgainst({ externalIds: { tcgdex: 'xy12-11' } }, [base, evolutions])
    expect(result).toMatchObject({ status: 'resolved', printingId: 'xy12-11', confidence: 1 })
  })

  it('disqualifies a different name whatever the other signals say', () => {
    const scored = scoreCandidate({ name: 'Blastoise', set: 'Base Set', cardNumber: '4' }, base)
    expect(scored.confidence).toBe(0)
    expect(resolveAgainst({ name: 'Blastoise', set: 'Base Set', cardNumber: '4' }, [base]).status).toBe('unresolved')
  })

  it('does not resolve when two candidates are too close', () => {
    const twin = { ...base, printingId: 'base4-4', setName: 'Base Set 2', setSlug: 'base-set-2', setExternalId: 'base4', externalIds: { tcgdex: 'base4-4' } }
    const result = resolveAgainst({ name: 'Charizard', cardNumber: '4', language: 'en' }, [base, twin])
    expect(result.status).toBe('ambiguous')
  })
})
