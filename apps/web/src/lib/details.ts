import type { GraphNode } from '@constellation/domain'

/** The data rows of a point, shared by the focus panel and the list view (relationships, not stats). */
export function detailRows(node: GraphNode): Array<[string, string]> {
  const m = node.metadata
  const rows: Array<[string, unknown]> = []
  switch (node.nodeType) {
    case 'card_printing':
      rows.push(
        ['Set', m.setName],
        ['Number', m.printedNumber ?? m.collectorNumber],
        ['Rarity', m.rarity],
        ['Finish', m.finish],
        ['Artist', m.artist],
        ['Type', Array.isArray(m.types) ? m.types.join(' / ') : null],
        ['Stage', m.stage],
        ['Language', m.language],
        ['Released', m.releaseDate],
      )
      break
    case 'card_identity':
      rows.push(['Printings', m.printingCount], ['Kind', m.entityType], ['First release', m.firstReleaseDate])
      break
    case 'set':
      rows.push(['Series', m.seriesName], ['Released', m.releaseDate], ['Cards', m.cardCountOfficial ?? m.printingCount], ['Imported', m.printingCount])
      break
    case 'series':
      rows.push(['Sets', m.setCount], ['Released', m.releaseDate])
      break
    case 'pokemon':
      rows.push(['Pokédex', m.dexId ? `#${m.dexId}` : null], ['Cards', m.cardCount])
      break
    case 'artist':
      rows.push(['Illustrations', m.illustrationCount])
      break
    case 'mechanic':
    case 'attribute':
      rows.push(['Cards', m.cardCount])
      break
    case 'game':
      rows.push(['Series', m.seriesCount], ['Sets', m.setCount])
      break
  }
  return rows
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)] as [string, string])
}
