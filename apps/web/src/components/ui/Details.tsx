import { Fragment } from 'react'
import type { DetailGroup, DetailRow } from '@/lib/details'
import { ElementIcon, elementOf } from './ElementIcon'
import { LanguageTag } from './LanguageTag'

/** The groups that follow the headline, in reading order. */
const LIST_GROUPS: DetailGroup[] = ['shows', 'edition', 'facts']

/**
 * The data of a point in one compact block. For a card the headline says where it is printed
 * ("Base Set · 4/102 · Rare · Holo"), then a tight two-column list follows, grouped: what the card
 * shows (type, stage, artist), its edition (language with its flag, release date). Every other kind
 * of point (set, series, artist, Pokémon…) gets the list alone. A value that stands for another
 * point — the set, the series, the artist — is a link that makes it the focus, so a parent is
 * always one click away.
 */
export function Details({
  rows,
  hrefFor,
  onSelect,
  className = '',
}: {
  rows: DetailRow[]
  /** An address for a linked value (list view); without it the link is a button. */
  hrefFor?: (nodeId: string) => string
  onSelect?: (nodeId: string) => void
  className?: string
}) {
  if (rows.length === 0) return null
  const headline = rows.filter((r) => r.group === 'print')
  const lists = LIST_GROUPS.map((group) => rows.filter((r) => r.group === group)).filter((group) => group.length > 0)
  return (
    <div className={`details fade-up ${className}`}>
      {headline.length > 0 ? (
        <p className="details-head">
          {headline.map((row, i) => (
            <Fragment key={row.label}>
              {i > 0 ? ' · ' : null}
              <span title={row.label}>
                <Value row={row} hrefFor={hrefFor} onSelect={onSelect} />
              </span>
            </Fragment>
          ))}
        </p>
      ) : null}
      {lists.map((group) => (
        <dl key={group[0]?.group} className="details-list">
          {group.map((row) => (
            <Fragment key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                <Value row={row} hrefFor={hrefFor} onSelect={onSelect} />
              </dd>
            </Fragment>
          ))}
        </dl>
      ))}
    </div>
  )
}

function Value({ row, hrefFor, onSelect }: { row: DetailRow; hrefFor?: (nodeId: string) => string; onSelect?: (nodeId: string) => void }) {
  const inner = row.format === 'types' ? <TypeValue value={row.value} /> : row.format === 'language' ? <LanguageTag language={row.value} /> : row.value
  const nodeId = row.nodeId
  if (!nodeId || (!hrefFor && !onSelect)) return <>{inner}</>
  if (hrefFor) {
    return (
      <a
        href={hrefFor(nodeId)}
        onClick={(e) => {
          if (!onSelect) return
          e.preventDefault()
          onSelect(nodeId)
        }}
        className="details-link"
        title={`Open ${row.value}`}
      >
        {inner}
      </a>
    )
  }
  return (
    <button type="button" onClick={() => onSelect?.(nodeId)} className="details-link" title={`Fly to ${row.value}`}>
      {inner}
    </button>
  )
}

/** `Fire / Water` → each element with its icon on the left. */
function TypeValue({ value }: { value: string }) {
  const parts = value.split(' / ')
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {parts.map((part) => {
        const element = elementOf(part)
        return (
          <span key={part} className="inline-flex items-center gap-1">
            {element ? <ElementIcon element={element} /> : null}
            {part}
          </span>
        )
      })}
    </span>
  )
}

/** A description with a little voice: serif, a soft accent bar, a slightly larger lead. */
export function Prose({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`quote fade-up ${className}`}>{children}</p>
}
