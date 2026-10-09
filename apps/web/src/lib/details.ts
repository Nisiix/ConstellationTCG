import { makeNodeId, type GraphEdge, type GraphNode } from '@constellation/domain'
import { formatDate } from './dates'
import { languageInfo } from './language'

/**
 * How the rows of a point are laid out: `print` (where a card is printed: set, number, rarity,
 * finish) becomes the headline, `shows` (type, stage, artist) and `edition` (language, release)
 * follow as a tight list, and `facts` is the single group every other kind of point has.
 */
export type DetailGroup = 'print' | 'shows' | 'edition' | 'facts'

export interface DetailRow {
  label: string
  value: string
  group: DetailGroup
  /** The point this value stands for (a card's set, a set's series, the artist): the renderer links it. */
  nodeId?: string
  /** A value with its own rendering: elements with their icons, a language with its flag. */
  format?: 'types' | 'language'
}

interface Draft {
  label: string
  value: unknown
  group: DetailGroup
  nodeId?: string | null
  format?: DetailRow['format']
}

/** `holo`, `first-edition` → `Holo`, `First edition`. */
function finishLabel(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  const spaced = value.replace(/[-_]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

function text(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** The other end of the first edge of this kind leaving `sourceId`, when it is in the neighborhood. */
function targetOf(edges: readonly GraphEdge[], sourceId: string, relationshipType: string): string | null {
  return edges.find((e) => e.sourceNodeId === sourceId && e.relationshipType === relationshipType)?.targetNodeId ?? null
}

/**
 * The data rows of a point, shared by the focus panel and the list view (relationships, not
 * stats). The edges of the current neighborhood let a row point at the node it names, so the
 * parent of a point (its set, its series) stays one click away without a connection group.
 */
export function detailRows(node: GraphNode, edges: readonly GraphEdge[] = []): DetailRow[] {
  const m = node.metadata
  const rows: Draft[] = []
  switch (node.nodeType) {
    case 'card_printing': {
      const setId = text(m.setId)
      rows.push(
        { label: 'Set', value: m.setName, group: 'print', nodeId: setId ? makeNodeId('set', setId) : targetOf(edges, node.id, 'BELONGS_TO') },
        { label: 'Number', value: m.printedNumber ?? m.collectorNumber, group: 'print' },
        { label: 'Rarity', value: m.rarity, group: 'print' },
        { label: 'Finish', value: finishLabel(m.finish), group: 'print' },
        { label: 'Type', value: Array.isArray(m.types) ? m.types.join(' / ') : null, group: 'shows', format: 'types' },
        { label: 'Stage', value: m.stage, group: 'shows' },
        { label: 'Artist', value: m.artist, group: 'shows', nodeId: targetOf(edges, node.id, 'ILLUSTRATED_BY') },
        { label: 'Language', value: languageInfo(text(m.language))?.code, group: 'edition', format: 'language' },
        { label: 'Released', value: formatDate(text(m.releaseDate)), group: 'edition' },
      )
      break
    }
    case 'card_identity':
      rows.push(
        { label: 'Printings', value: m.printingCount, group: 'facts' },
        { label: 'Kind', value: m.entityType, group: 'facts' },
        { label: 'First release', value: formatDate(text(m.firstReleaseDate)), group: 'facts' },
      )
      break
    case 'set':
      rows.push(
        { label: 'Series', value: m.seriesName, group: 'facts', nodeId: targetOf(edges, node.id, 'PART_OF') },
        { label: 'Released', value: formatDate(text(m.releaseDate)), group: 'facts' },
        { label: 'Cards', value: m.cardCountOfficial ?? m.printingCount, group: 'facts' },
      )
      break
    case 'series':
      rows.push({ label: 'Sets', value: m.setCount, group: 'facts' }, { label: 'Released', value: formatDate(text(m.releaseDate)), group: 'facts' })
      break
    case 'pokemon':
      rows.push({ label: 'Pokédex', value: m.dexId ? `#${m.dexId}` : null, group: 'facts' }, { label: 'Cards', value: m.cardCount, group: 'facts' })
      break
    case 'artist':
      rows.push({ label: 'Illustrations', value: m.illustrationCount, group: 'facts' })
      break
    case 'mechanic':
    case 'attribute':
      rows.push({ label: 'Cards', value: m.cardCount, group: 'facts' })
      break
    case 'game':
      rows.push({ label: 'Series', value: m.seriesCount, group: 'facts' }, { label: 'Sets', value: m.setCount, group: 'facts' })
      break
  }
  return rows
    .filter(({ value }) => value !== null && value !== undefined && value !== '')
    .map(({ label, value, group, nodeId, format }) => {
      const row: DetailRow = { label, value: String(value), group }
      if (nodeId) row.nodeId = nodeId
      if (format) row.format = format
      return row
    })
}
