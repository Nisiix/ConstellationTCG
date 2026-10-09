import { describe, expect, it } from 'vitest'
import { coveredBySkyFont, skyLabel } from '../sky-label'

describe('skyLabel', () => {
  it('keeps names the label font can draw', () => {
    expect(skyLabel('Charizard')).toBe('Charizard')
    expect(skyLabel('Pokémon Center')).toBe('Pokémon Center')
    expect(skyLabel('Farfetch’d')).toBe('Farfetch’d')
    expect(skyLabel('Flabébé')).toBe('Flabébé')
  })

  it('spells out the symbols card names use', () => {
    expect(skyLabel('Nidoran♀')).toBe('Nidoran F')
    expect(skyLabel('Nidoran♂')).toBe('Nidoran M')
    expect(skyLabel('Pikachu δ')).toBe('Pikachu Delta')
    expect(skyLabel('Gyarados ☆')).toBe('Gyarados Star')
    expect(skyLabel('Giratina ◇')).toBe('Giratina Prism Star')
  })

  it('drops anything else the font lacks, so the text builder never fetches a fallback font', () => {
    const label = skyLabel('ピカチュウ Pikachu ✦')
    expect(label).toBe('Pikachu')
    for (const ch of label) expect(coveredBySkyFont(ch.codePointAt(0) ?? 0)).toBe(true)
  })

  it('never returns an empty label', () => {
    expect(skyLabel('ピカチュウ')).toBe('·')
  })
})
