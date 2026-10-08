'use client'

import { useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { edgeColor, useNodeColor, useTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'
import { useOtherPrintings } from '../useOtherPrintings'
import { useRelationshipGroups, type RelationshipGroup } from '../useRelationshipGroups'
import { NodeBadge } from './NodeBadge'
import { NodeImage } from './NodeImage'

const DEPTH_LABEL: Record<number, string> = { 1: 'direct connections', 2: 'extended connections', 3: 'deep connections' }

export function FocusPanel() {
  const navigation = useExploreNavigation()
  const { focus, groups } = useRelationshipGroups()
  const depth = useGraphStore((s) => s.depth)
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const truncated = useGraphStore((s) => s.truncated)
  const filtered = useGraphStore((s) => s.filtered)
  const welcomeVisible = useUiStore((s) => s.welcomeVisible)
  const setHighlight = useUiStore((s) => s.setHighlight)
  const other = useOtherPrintings(focus)
  const [copied, setCopied] = useState(false)

  // On the first visit the welcome card takes the stage; the game panel returns once dismissed.
  if (!focus || (welcomeVisible && isUniverse)) return null

  const meta = focus.metadata
  const isCard = focus.nodeType === 'card_printing' || focus.nodeType === 'card_identity'
  const details = detailRows(focus)

  const share = async () => {
    try {
      await navigator.clipboard.writeText(navigation.shareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <aside
      id="focus-panel"
      aria-label="Focus"
      className="panel scroll-thin fade-up absolute right-4 top-16 z-30 flex max-h-[calc(100vh-9rem)] w-[21rem] flex-col overflow-y-auto"
      key={focus.id}
      onMouseLeave={() => setHighlight(null)}
    >
      <div className="p-5 pb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <NodeBadge type={focus.nodeType} />
          <div className="flex items-center gap-1">
            <button type="button" onClick={navigation.back} className="btn btn-quiet text-[12.5px]" title="Go back (Backspace)">
              ← Back
            </button>
            <button type="button" onClick={share} className="btn btn-quiet text-[12.5px]" title="Copy a link to this view">
              {copied ? 'Link copied' : 'Share'}
            </button>
          </div>
        </div>
        <h1 className="text-[24px] leading-tight text-ink">{focus.label}</h1>
        {focus.subtitle ? <p className="mt-0.5 text-[14px] text-ink-dim">{focus.subtitle}</p> : null}
      </div>

      {focus.imageUrl && isCard ? (
        <div className="flex justify-center bg-void/40 px-5 py-4">
          <NodeImage node={focus} variant="card" className="img-frame fade-up w-48 rounded-lg" loading="eager" />
        </div>
      ) : focus.imageUrl && focus.nodeType !== 'game' ? (
        <div className="flex justify-center bg-void/40 px-5 py-4">
          <NodeImage node={focus} variant="logo" className="max-h-16 object-contain" loading="eager" placeholder={null} />
        </div>
      ) : null}

      {details.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-ink/10 px-5 py-4 text-[13px]">
          {details.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-ink-dim">{k}</dt>
              <dd className="truncate text-ink" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {typeof meta.description === 'string' && meta.description ? (
        <p className="serif border-t border-ink/10 px-5 py-4 text-[14px] leading-relaxed text-ink/85">{meta.description}</p>
      ) : null}

      {focus.nodeType === 'card_printing' && other.status !== 'idle' ? (
        <OtherPrintingsView other={other} onSelect={(id) => navigation.goTo(id, { follow: true })} />
      ) : null}

      <div className="border-t border-ink/10 px-5 py-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="serif text-[17px]">Connections</h2>
          <span className="text-[12px] text-ink-dim">
            {DEPTH_LABEL[depth] ?? ''}
            {truncated ? ' · partial' : ''}
            {filtered ? ' · filtered' : ''}
          </span>
        </div>
        {!isUniverse ? (
          <div className="mb-4 flex gap-2">
            <button type="button" onClick={navigation.expand} disabled={depth >= 3} className="btn btn-primary flex-1" title="Also show what the connections are connected to (E)">
              Show more
            </button>
            <button type="button" onClick={navigation.collapse} disabled={depth <= 1} className="btn btn-ghost flex-1" title="Only direct connections (C)">
              Direct only
            </button>
          </div>
        ) : (
          <p className="mb-4 text-[13px] text-ink-dim">Pick a series or a set to dive in, or search for a card above.</p>
        )}
        {groups.length === 0 ? <p className="text-sm text-ink-dim">No connections yet.</p> : null}
        {groups.length > 0 ? (
          <p className="mb-3 text-[12px] text-ink-dim">Hover a group or a row to light it up in the sky. Click to fly there.</p>
        ) : null}
        <div className="space-y-4">
          {groups.map((group, i) => (
            <div key={group.key} className="pop-in" style={{ '--i': i } as React.CSSProperties}>
              <RelationshipGroupView group={group} onSelect={(id) => navigation.goTo(id, { follow: true })} />
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

function RelationshipGroupView({ group, onSelect }: { group: RelationshipGroup; onSelect: (nodeId: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const theme = useTheme()
  const colorOf = useNodeColor()
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)
  const setHighlight = useUiStore((s) => s.setHighlight)
  const limit = 6
  const items = expanded ? group.items : group.items.slice(0, limit)
  const lineColor = edgeColor(theme, group.relationshipType)
  const highlightGroup = () => setHighlight(group.items.map((i) => i.node.id))
  return (
    <section aria-label={group.label} onMouseEnter={highlightGroup} onMouseLeave={() => setHighlight(null)}>
      <h3 className="eyebrow mb-1 flex items-center justify-between">
        <span className="flex items-center gap-2">
          {/* the color of the lines of this kind in the sky */}
          <span className="inline-block h-[2px] w-4 rounded-full" style={{ background: lineColor }} aria-hidden />
          {group.label}
        </span>
        <span className="font-normal">{group.total}</span>
      </h3>
      <ul className="space-y-0.5">
        {items.map(({ node, metadata }) => (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              onMouseEnter={() => setHighlight([node.id])}
              onMouseLeave={highlightGroup}
              className={`row-link ${hoveredNodeId === node.id ? 'bg-primary/15' : ''}`}
              title={`Fly to ${node.label}`}
              data-node-id={node.id}
            >
              <span className="dot" style={{ color: colorOf(node.nodeType) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              {typeof metadata.value === 'string' ? (
                <span className="text-[12px] text-ink-dim">{metadata.value}</span>
              ) : node.subtitle ? (
                <span className="max-w-[45%] truncate text-[12px] text-ink-dim">{node.subtitle}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {group.items.length > limit ? (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="btn btn-quiet mt-1 text-[12.5px]">
          {expanded ? 'Show less' : `Show ${group.items.length - limit} more`}
        </button>
      ) : group.total > group.items.length ? (
        <p className="mt-1 px-2 text-[12px] text-ink-dim">
          {group.items.length} of {group.total} shown — use “Show more” or filters to see the rest
        </p>
      ) : null}
    </section>
  )
}

/** The other expansions a card was printed in: the question a collector asks first. */
function OtherPrintingsView({ other, onSelect }: { other: ReturnType<typeof useOtherPrintings>; onSelect: (nodeId: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const setHighlight = useUiStore((s) => s.setHighlight)
  const limit = 5
  const items = expanded ? other.printings : other.printings.slice(0, limit)
  return (
    <section className="border-t border-ink/10 px-5 py-4" aria-label="Also printed in">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="serif text-[17px]">Also printed in</h2>
        {other.status === 'ready' ? <span className="text-[12px] text-ink-dim">{other.printings.length}</span> : null}
      </div>
      {other.status === 'loading' ? <p className="text-[13px] text-ink-dim">Looking for other printings…</p> : null}
      {other.status === 'error' ? <p className="text-[13px] text-ink-dim">Other printings are unavailable right now.</p> : null}
      {other.status === 'ready' && other.printings.length === 0 ? (
        <p className="text-[13px] text-ink-dim">This is the only printing of this card in the catalog.</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="space-y-0.5">
          {items.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                onClick={() => onSelect(node.id)}
                onMouseEnter={() => setHighlight([node.id])}
                onMouseLeave={() => setHighlight(null)}
                className="row-link"
                title={`Fly to ${node.label} (${node.subtitle ?? ''})`}
              >
                <NodeImage node={node} small alt="" loading="lazy" className="img-frame h-10 w-7 flex-none rounded object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px]">{String(node.metadata.setName ?? node.subtitle ?? '')}</span>
                  <span className="block truncate text-[12px] text-ink-dim">
                    {String(node.metadata.printedNumber ?? node.metadata.collectorNumber ?? '')}
                    {typeof node.metadata.releaseDate === 'string' ? ` · ${node.metadata.releaseDate.slice(0, 4)}` : ''}
                    {typeof node.metadata.rarity === 'string' ? ` · ${node.metadata.rarity}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {other.printings.length > limit ? (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="btn btn-quiet mt-1 text-[12.5px]">
          {expanded ? 'Show less' : `Show ${other.printings.length - limit} more`}
        </button>
      ) : null}
      {other.identityNodeId ? (
        <button type="button" onClick={() => onSelect(other.identityNodeId as string)} className="btn btn-quiet mt-1 text-[12.5px]" title="Open the card with all its printings around it">
          See the card and all its printings →
        </button>
      ) : null}
    </section>
  )
}

function detailRows(node: GraphNode): Array<[string, string]> {
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
