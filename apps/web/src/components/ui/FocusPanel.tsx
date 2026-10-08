'use client'

import { useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { useNodeColor } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useExploreNavigation } from '../navigation'
import { useRelationshipGroups, type RelationshipGroup } from '../useRelationshipGroups'
import { NodeBadge } from './NodeBadge'

export function FocusPanel() {
  const navigation = useExploreNavigation()
  const { focus, groups } = useRelationshipGroups()
  const depth = useGraphStore((s) => s.depth)
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const truncated = useGraphStore((s) => s.truncated)
  const filtered = useGraphStore((s) => s.filtered)
  const [copied, setCopied] = useState(false)

  if (!focus) return null

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
      className="glass scroll-thin fade-up absolute right-4 top-16 z-30 flex max-h-[calc(100vh-9rem)] w-80 flex-col overflow-y-auto rounded-xl"
      key={focus.id}
    >
      <div className="border-b border-ink-dim/15 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <NodeBadge type={focus.nodeType} />
          <div className="flex items-center gap-1">
            <button type="button" onClick={navigation.back} className="chip focus-ring rounded px-1.5 py-0.5 text-[11px] text-ink-dim hover:text-ink" title="Back (Backspace)">
              ←
            </button>
            <button type="button" onClick={share} className="chip focus-ring rounded px-1.5 py-0.5 text-[11px] text-ink-dim hover:text-ink" title="Copy link">
              {copied ? 'copied ✓' : 'share'}
            </button>
          </div>
        </div>
        <h1 className="title-shimmer text-lg font-semibold leading-tight tracking-wide">{focus.label}</h1>
        {focus.subtitle ? <p className="text-sm text-ink-dim">{focus.subtitle}</p> : null}
      </div>

      {focus.imageUrl && isCard ? (
        <div className="flex justify-center border-b border-ink-dim/15 bg-void/40 p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={focus.imageUrl}
            alt={`${focus.label} card`}
            className="fade-up w-44 rounded-md shadow-[0_0_0_1.5px_var(--c-outline),0_0_40px_color-mix(in_oklab,var(--c-primary)_30%,transparent)]"
            loading="eager"
          />
        </div>
      ) : focus.imageUrl && focus.nodeType !== 'game' ? (
        <div className="flex justify-center border-b border-ink-dim/15 bg-void/40 p-4">
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
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-b border-ink-dim/15 p-4 text-xs">
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
        <p className="border-b border-ink-dim/15 p-4 text-xs leading-relaxed text-ink-dim">{meta.description}</p>
      ) : null}

      <div className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="hud-label">Relationships</span>
          <span className="font-mono text-[10px] text-ink-dim">
            depth {depth}
            {truncated ? ' · partial' : ''}
            {filtered ? ' · filtered' : ''}
          </span>
        </div>
        {!isUniverse ? (
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={navigation.expand}
              disabled={depth >= 3}
              className="chip focus-ring flex-1 rounded-md border border-primary/50 px-2 py-1 text-xs text-primary hover:bg-primary/15 disabled:opacity-40"
            >
              Expand
            </button>
            <button
              type="button"
              onClick={navigation.collapse}
              disabled={depth <= 1}
              className="chip focus-ring flex-1 rounded-md border border-ink-dim/30 px-2 py-1 text-xs text-ink-dim hover:text-ink disabled:opacity-40"
            >
              Collapse
            </button>
          </div>
        ) : null}
        {groups.length === 0 ? <p className="text-xs text-ink-dim">No relationships yet.</p> : null}
        <div className="space-y-3">
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
      <h2 className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-ink-dim">
        <span>{group.label}</span>
        <span className="font-mono text-[10px]">{group.total}</span>
      </h2>
      <ul className="space-y-0.5">
        {items.map(({ node, metadata }) => (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onSelect(node.id)}
              className="lift focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm text-ink/90 hover:bg-primary/15"
            >
              <span
                className="h-1.5 w-1.5 flex-none rounded-full"
                style={{ background: colorOf(node.nodeType), boxShadow: '0 0 0 1px var(--c-outline)' }}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              {typeof metadata.value === 'string' ? (
                <span className="font-mono text-[10px] text-ink-dim">{metadata.value}</span>
              ) : node.subtitle ? (
                <span className="max-w-[40%] truncate text-[10px] text-ink-dim">{node.subtitle}</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {group.items.length > limit ? (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="focus-ring mt-1 px-2 text-[11px] text-primary hover:underline">
          {expanded ? 'Show less' : `Show ${group.items.length - limit} more`}
        </button>
      ) : group.total > group.items.length ? (
        <p className="mt-1 px-2 text-[10px] text-ink-dim">
          {group.items.length} of {group.total} shown — expand or filter to see more
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
