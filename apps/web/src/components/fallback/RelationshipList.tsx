'use client'

import { useMemo, useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'
import { buildExploreUrl } from '@/lib/url'
import { useGraphStore } from '@/state/graph-store'
import { useExploreNavigation } from '../navigation'
import { useRelationshipGroups, type RelationshipGroup } from '../useRelationshipGroups'
import { NodeBadge } from '../ui/NodeBadge'
import { NodeImage } from '../ui/NodeImage'

const DEPTH_LABEL: Record<number, string> = { 1: 'Direct connections', 2: 'Extended connections', 3: 'Deep connections' }

/**
 * List view: a full page with everything about the focus and its connections, laid out as a
 * readable document (no 3D). The same links as the scene; the "3D" button brings the scene back.
 */
export function RelationshipList() {
  const navigation = useExploreNavigation()
  const { focus, groups } = useRelationshipGroups()
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const distances = useGraphStore((s) => s.distances)
  const depth = useGraphStore((s) => s.depth)
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const truncated = useGraphStore((s) => s.truncated)
  const filtered = useGraphStore((s) => s.filtered)
  const [copied, setCopied] = useState(false)

  const current = navigation.current
  const hrefFor = (nodeId: string) => buildExploreUrl({ ...current, node: nodeId, depth: 1 })

  const universe = useMemo(() => {
    if (!isUniverse) return null
    const series = nodes.filter((n) => n.nodeType === 'series')
    const sets = nodes.filter((n) => n.nodeType === 'set')
    const seriesOfSet = new Map<string, string>()
    for (const e of edges) if (e.relationshipType === 'PART_OF') seriesOfSet.set(e.sourceNodeId, e.targetNodeId)
    const bySeries = new Map<string, GraphNode[]>()
    for (const set of sets) {
      const key = seriesOfSet.get(set.id) ?? 'other'
      const list = bySeries.get(key) ?? []
      list.push(set)
      bySeries.set(key, list)
    }
    return { series, bySeries, orphanSets: bySeries.get('other') ?? [] }
  }, [isUniverse, nodes, edges])

  const farther = useMemo(
    () =>
      Object.entries(distances)
        .filter(([, d]) => d >= 2)
        .map(([id]) => nodes.find((n) => n.id === id))
        .filter((n): n is GraphNode => Boolean(n)),
    [distances, nodes],
  )

  if (!focus) return null

  const go = (nodeId: string, follow = false) => (e: React.MouseEvent) => {
    e.preventDefault()
    navigation.goTo(nodeId, { follow })
  }

  const share = async () => {
    try {
      await navigator.clipboard.writeText(navigation.shareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  const isCard = focus.nodeType === 'card_printing' || focus.nodeType === 'card_identity'
  const details = detailRows(focus)

  return (
    <main id="relationship-list" aria-label="List view" className="scroll-thin absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto px-4 pb-24 pt-4">
      <div className="mx-auto w-full max-w-6xl">
        {/* ── header ── */}
        <header className="panel fade-up flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <NodeBadge type={focus.nodeType} />
              <span className="text-[12.5px] text-ink-dim">
                {isUniverse ? 'Universe' : DEPTH_LABEL[depth]}
                {truncated ? ' · partial' : ''}
                {filtered ? ' · filtered' : ''}
              </span>
            </div>
            <h1 className="text-[34px] leading-tight">{focus.label}</h1>
            {focus.subtitle ? <p className="mt-1 text-[15px] text-ink-dim">{focus.subtitle}</p> : null}
          </div>
          <div className="flex flex-none flex-wrap items-center gap-2">
            <button type="button" onClick={navigation.back} className="btn btn-ghost">
              ← Back
            </button>
            <button type="button" onClick={share} className="btn btn-ghost">
              {copied ? 'Link copied' : 'Share'}
            </button>
            {!isUniverse ? (
              <>
                <button type="button" onClick={navigation.expand} disabled={depth >= 3} className="btn btn-ghost" title="Also show what the connections are connected to (E)">
                  Show more
                </button>
                <button type="button" onClick={navigation.collapse} disabled={depth <= 1} className="btn btn-ghost" title="Direct connections only (C)">
                  Direct only
                </button>
              </>
            ) : null}
            <button type="button" onClick={() => navigation.setView('3d')} className="btn btn-primary" title="Back to the constellation (L)">
              Open in 3D
            </button>
          </div>
        </header>

        {isUniverse && universe ? (
          <UniverseCatalog series={universe.series} bySeries={universe.bySeries} orphanSets={universe.orphanSets} hrefFor={hrefFor} go={go} />
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-[20rem_1fr]">
            {/* ── left: identity ── */}
            <div className="space-y-4">
              {focus.imageUrl ? (
                <section className="panel fade-up flex justify-center p-5">
                  <NodeImage
                    node={focus}
                    className={isCard ? 'img-frame w-full max-w-[16rem] rounded-xl' : 'max-h-28 object-contain'}
                    loading="eager"
                    placeholder={null}
                  />
                </section>
              ) : null}
              {details.length > 0 ? (
                <section className="panel fade-up p-5" aria-label="Details">
                  <h2 className="serif mb-3 text-[18px]">Details</h2>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
                    {details.map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-ink-dim">{k}</dt>
                        <dd className="text-ink">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
              {typeof focus.metadata.description === 'string' && focus.metadata.description ? (
                <section className="panel fade-up p-5" aria-label="Description">
                  <h2 className="serif mb-2 text-[18px]">Description</h2>
                  <p className="serif text-[15px] leading-relaxed text-ink/90">{focus.metadata.description}</p>
                </section>
              ) : null}
            </div>

            {/* ── right: connections ── */}
            <div className="space-y-4">
              {groups.length === 0 ? (
                <section className="panel p-5 text-[14px] text-ink-dim">No connections yet.</section>
              ) : (
                groups.map((group, i) => (
                  <GroupSection key={group.key} group={group} index={i} hrefFor={hrefFor} go={go} />
                ))
              )}
              {farther.length > 0 ? (
                <section className="panel fade-up p-5" aria-label="Further away">
                  <h2 className="serif mb-1 text-[18px]">Further away</h2>
                  <p className="mb-3 text-[13px] text-ink-dim">Two or three steps from {focus.label}.</p>
                  <ul className="flex flex-wrap gap-1.5">
                    {farther.slice(0, 160).map((node) => (
                      <li key={node.id}>
                        <a href={hrefFor(node.id)} onClick={go(node.id)} className="chip">
                          {node.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function Thumb({ node }: { node: GraphNode }) {
  const colorOf = useNodeColor()
  const logo = node.nodeType === 'set' || node.nodeType === 'series' || node.nodeType === 'game'
  return (
    <NodeImage
      node={node}
      small
      alt=""
      loading="lazy"
      className={logo ? 'h-10 w-14 flex-none rounded-md bg-node object-contain p-1' : 'img-frame h-12 w-9 flex-none rounded-md object-cover'}
      placeholder={
        <span className="flex h-12 w-9 flex-none items-center justify-center rounded-md" style={{ background: `color-mix(in oklab, ${colorOf(node.nodeType)} 14%, transparent)` }} aria-hidden>
          <span className="dot" style={{ color: colorOf(node.nodeType) }} />
        </span>
      }
    />
  )
}

function GroupSection({
  group,
  index,
  hrefFor,
  go,
}: {
  group: RelationshipGroup
  index: number
  hrefFor: (id: string) => string
  go: (id: string, follow?: boolean) => (e: React.MouseEvent) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const limit = 12
  const items = expanded ? group.items : group.items.slice(0, limit)
  return (
    <section className="panel pop-in p-5" style={{ '--i': index } as React.CSSProperties} aria-label={group.label}>
      <h2 className="serif mb-3 flex items-baseline justify-between text-[18px]">
        <span>{group.label}</span>
        <span className="text-[13px] text-ink-dim">{group.total}</span>
      </h2>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
        {items.map(({ node, metadata }) => (
          <li key={node.id}>
            <a href={hrefFor(node.id)} onClick={go(node.id, true)} className="row-link" title={NODE_TYPE_LABELS[node.nodeType]}>
              <Thumb node={node} />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{node.label}</span>
                <span className="block truncate text-[12px] text-ink-dim">{typeof metadata.value === 'string' ? metadata.value : node.subtitle}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {group.items.length > limit ? (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="btn btn-quiet mt-2 text-[13px]">
          {expanded ? 'Show less' : `Show ${group.items.length - limit} more`}
        </button>
      ) : group.total > group.items.length ? (
        <p className="mt-2 text-[12.5px] text-ink-dim">
          {group.items.length} of {group.total} shown — use “Show more” or filters to see the rest
        </p>
      ) : null}
    </section>
  )
}

function UniverseCatalog({
  series,
  bySeries,
  orphanSets,
  hrefFor,
  go,
}: {
  series: GraphNode[]
  bySeries: Map<string, GraphNode[]>
  orphanSets: GraphNode[]
  hrefFor: (id: string) => string
  go: (id: string, follow?: boolean) => (e: React.MouseEvent) => void
}) {
  return (
    <div className="mt-4 space-y-4">
      {series.map((s, i) => {
        const sets = bySeries.get(s.id) ?? []
        return (
          <section key={s.id} className="panel pop-in p-5" style={{ '--i': Math.min(i, 20) } as React.CSSProperties} aria-label={s.label}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <a href={hrefFor(s.id)} onClick={go(s.id)} className="flex min-w-0 items-center gap-3">
                <Thumb node={s} />
                <span className="min-w-0">
                  <span className="serif block truncate text-[20px]">{s.label}</span>
                  <span className="block text-[12.5px] text-ink-dim">
                    {s.subtitle}
                    {typeof s.metadata.releaseDate === 'string' ? ` · since ${s.metadata.releaseDate.slice(0, 4)}` : ''}
                  </span>
                </span>
              </a>
            </div>
            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-4">
              {sets.map((set) => (
                <li key={set.id}>
                  <a href={hrefFor(set.id)} onClick={go(set.id)} className="row-link" title={String(set.metadata.releaseDate ?? '')}>
                    <Thumb node={set} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{set.label}</span>
                      <span className="block truncate text-[12px] text-ink-dim">
                        {typeof set.metadata.printingCount === 'number' ? `${set.metadata.printingCount} cards` : ''}
                        {typeof set.metadata.releaseDate === 'string' ? ` · ${set.metadata.releaseDate}` : ''}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {orphanSets.length > 0 ? (
        <section className="panel p-5" aria-label="Other sets">
          <h2 className="serif mb-3 text-[20px]">Other sets</h2>
          <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-4">
            {orphanSets.map((set) => (
              <li key={set.id}>
                <a href={hrefFor(set.id)} onClick={go(set.id)} className="row-link">
                  <Thumb node={set} />
                  <span className="min-w-0 flex-1 truncate">{set.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
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
        ['Regulation mark', m.regulationMark],
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
