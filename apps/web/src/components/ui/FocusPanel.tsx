'use client'

import { useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { useNodeColor } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'
import { useRelationshipGroups, type RelationshipGroup } from '../useRelationshipGroups'
import { NodeBadge } from './NodeBadge'

const DEPTH_LABEL: Record<number, string> = { 1: 'direct connections', 2: 'extended connections', 3: 'deep connections' }

export function FocusPanel() {
  const navigation = useExploreNavigation()
  const { focus, groups } = useRelationshipGroups()
  const depth = useGraphStore((s) => s.depth)
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const truncated = useGraphStore((s) => s.truncated)
  const filtered = useGraphStore((s) => s.filtered)
  const welcomeVisible = useUiStore((s) => s.welcomeVisible)
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={focus.imageUrl}
            alt={`${focus.label} card`}
            className="fade-up w-48 rounded-lg shadow-[0_0_0_1.5px_var(--c-outline),0_18px_40px_rgba(0,0,0,0.5)]"
            loading="eager"
          />
        </div>
      ) : focus.imageUrl && focus.nodeType !== 'game' ? (
        <div className="flex justify-center bg-void/40 px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={focus.imageUrl}
            alt={`${focus.label} logo`}
            className="max-h-16 object-contain"
            loading="eager"
            onError={(e) => {
              ;(e.currentTarget.parentElement as HTMLElement | null)?.setAttribute('hidden', '')
            }}
          />
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
  const colorOf = useNodeColor()
  const limit = 6
  const items = expanded ? group.items : group.items.slice(0, limit)
  return (
    <section aria-label={group.label}>
      <h3 className="eyebrow mb-1 flex items-center justify-between">
        <span>{group.label}</span>
        <span className="font-normal">{group.total}</span>
      </h3>
      <ul className="space-y-0.5">
        {items.map(({ node, metadata }) => (
          <li key={node.id}>
            <button type="button" onClick={() => onSelect(node.id)} className="row-link" title={`Fly to ${node.label}`}>
              <span className="dot" style={{ background: colorOf(node.nodeType) }} aria-hidden />
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
        ['HP', m.hp],
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
