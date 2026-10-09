import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { GraphNode } from '@constellation/domain'
import { describe, expect, it } from 'vitest'
import { detailRows } from '@/lib/details'
import { Details } from '../ui/Details'
import { LanguageTag } from '../ui/LanguageTag'

function node(id: string, nodeType: GraphNode['nodeType'], metadata: Record<string, unknown> = {}): GraphNode {
  return { id, gameId: 'g', nodeType, entityId: id, label: id, subtitle: null, imageUrl: null, metadata }
}

const charizard = node('card_printing:1', 'card_printing', {
  setId: 'base1',
  setName: 'Base Set',
  printedNumber: '4/102',
  rarity: 'Rare',
  finish: 'holo',
  artist: 'Mitsuhiro Arita',
  types: ['Fire'],
  stage: 'Stage2',
  language: 'en',
  releaseDate: '1999-01-09',
})

describe('Details', () => {
  const html = renderToStaticMarkup(createElement(Details, { rows: detailRows(charizard), hrefFor: (id) => `/explore?node=${id}` }))

  it('opens with one headline saying where the card is printed, the set being a link', () => {
    const text = html.replace(/<[^>]+>/g, '')
    expect(text.startsWith('Base Set · 4/102 · Rare · Holo')).toBe(true)
    expect(html).toContain('<a href="/explore?node=set:base1" class="details-link" title="Open Base Set">Base Set</a>')
  })

  it('lists the rest as label/value pairs, grouped, with the element icon and the language flag', () => {
    expect(html).toContain('<dt>Type</dt>')
    expect(html).toContain('el-fire')
    expect(html).toContain('<dt>Artist</dt>')
    expect(html).toContain('<dt>Language</dt>')
    expect(html).toContain('aria-label="English"')
    expect(html).toContain('<span>EN</span>')
    expect(html).toContain('<dt>Released</dt><dd>09-01-1999</dd>')
    expect((html.match(/<dl /g) ?? []).length).toBe(2)
    expect(html).not.toContain('Imported')
    expect(html).not.toContain('<dt>Set</dt>')
  })

  it('renders a linked value as a button when there is no address to link to', () => {
    const buttons = renderToStaticMarkup(createElement(Details, { rows: detailRows(charizard), onSelect: () => {} }))
    expect(buttons).toContain('<button type="button" class="details-link" title="Fly to Base Set">Base Set</button>')
  })

  it('shows a set as a plain list with its series linked', () => {
    const set = node('set:base1', 'set', { seriesName: 'Base', releaseDate: '1999-01-09', cardCountOfficial: 102 })
    const rows = detailRows(set, [{ id: 'e', sourceNodeId: 'set:base1', targetNodeId: 'series:base', relationshipType: 'PART_OF', weight: 1, direction: 'directed', metadata: {} }])
    const out = renderToStaticMarkup(createElement(Details, { rows, hrefFor: (id) => `/${id}` }))
    expect(out).not.toContain('details-head')
    expect(out).toContain('<dt>Series</dt><dd><a href="/series:base" class="details-link" title="Open Base">Base</a></dd>')
  })

  it('renders nothing for a point without rows', () => {
    expect(renderToStaticMarkup(createElement(Details, { rows: [] }))).toBe('')
  })
})

describe('LanguageTag', () => {
  it('puts the flag to the left of the uppercase code, as inline SVG with an accessible name', () => {
    const html = renderToStaticMarkup(createElement(LanguageTag, { language: 'zh-tw' }))
    expect(html.indexOf('<svg')).toBeGreaterThan(-1)
    expect(html.indexOf('<svg')).toBeLessThan(html.indexOf('<span>ZH-TW</span>'))
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Chinese (Traditional)"')
    expect(html).toContain('class="lang-flag"')
    expect(html).not.toContain('<img')
  })

  it('shows an unknown language as its code alone, and nothing for no language', () => {
    expect(renderToStaticMarkup(createElement(LanguageTag, { language: 'xx' }))).toBe('<span class="lang " title="XX"><span>XX</span></span>')
    expect(renderToStaticMarkup(createElement(LanguageTag, { language: null }))).toBe('')
  })
})
