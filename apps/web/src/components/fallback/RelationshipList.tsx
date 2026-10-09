'use client'

import { useMemo, useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { detailRows } from '@/lib/details'
import { prettySharePath } from '@/lib/pretty-url'
import { edgeColor, useNodeColor, useTheme } from '@/lib/theme'
import { buildExploreUrl } from '@/lib/url'
import { useGraphStore } from '@/state/graph-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useExploreNavigation } from '../navigation'
import { useOtherPrintings } from '../useOtherPrintings'
import { useRelationshipGroups, type RelationshipGroup } from '../useRelationshipGroups'
import { ElementIcon, elementOfNode } from '../ui/ElementIcon'
import { Facts, Prose } from '../ui/Facts'
import { NodeBadge } from '../ui/NodeBadge'
import { NodeImage } from '../ui/NodeImage'
import { OwnButton } from '../ui/OwnButton'

const DEPTH_LABEL: Record<number, string> = { 1: 'Direct connections', 2: 'Extended connections', 3: 'Deep connections' }

type Go = (id: string, follow?: boolean) => (e: React.MouseEvent) => void

/**
 * List view: the same exploration as the sky, without WebGL. Two panels and no more: the point
 * (image, data, description, other printings) on the left, every connection on the right as
 * compact chips grouped by kind, so a card's sets, Pokémon, artist, evolutions and printings are
 * all in view at once. The same links as the scene; depth and the 3D/List switch live in the HUD.
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
  const other = useOtherPrintings(focus)
  const [copied, setCopied] = useState(false)

  const current = navigation.current
  const hrefFor = (nodeId: string) => buildExploreUrl({ ...current, node: nodeId, depth: 1 })

  const universe = useMemo(() => {
    if (!isUniverse) return null
    const byRelease = (a: GraphNode, b: GraphNode) =>
      String(b.metadata.releaseDate ?? '').localeCompare(String(a.metadata.releaseDate ?? '')) || a.label.localeCompare(b.label)
    // Expansions from the most recent to the oldest.
    const series = nodes.filter((n) => n.nodeType === 'series').sort(byRelease)
    const sets = nodes.filter((n) => n.nodeType === 'set').sort(byRelease)
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

  const go: Go = (nodeId, follow = false) => (e) => {
    e.preventDefault()
    navigation.goTo(nodeId, { follow })
  }

  const share = async () => {
    try {
      const pretty = prettySharePath(focus, navigation.current)
      await navigator.clipboard.writeText(pretty ? `${window.location.origin}${pretty}` : navigation.shareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  const isCard = focus.nodeType === 'card_printing' || focus.nodeType === 'card_identity'
  const details = detailRows(focus)
  const description = typeof focus.metadata.description === 'string' ? focus.metadata.description : null

  return (
    <main id="relationship-list" aria-label="List view" className="scroll-thin absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto px-4 pb-24 pt-3">
      <div className="mx-auto w-full max-w-6xl">
        {isUniverse && universe ? (
          <>
            {/* ── the universe: one header, then the expansions newest first ── */}
            <header className="panel fade-up flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <NodeBadge type={focus.nodeType} />
                <div className="min-w-0">
                  <h1 className="title-reveal truncate text-[26px] leading-tight">{focus.label}</h1>
                  <p className="text-[13px] text-ink-dim">
                    Universe · pick a series or a set, or search for a card above.
                    {nodes.filter((n) => n.nodeType === 'set').length === 1
                      ? ' Only the bundled Base Set is loaded for now: `pnpm ingest` then `pnpm graph:build` bring in every expansion and the reprints across sets.'
                      : ''}
                  </p>
                </div>
              </div>
              <button type="button" onClick={share} className="btn btn-ghost flex-none">
                {copied ? 'Link copied' : 'Share'}
              </button>
            </header>
            <UniverseCatalog series={universe.series} bySeries={universe.bySeries} orphanSets={universe.orphanSets} hrefFor={hrefFor} go={go} />
          </>
        ) : (
          <div className="grid gap-3 md:grid-cols-[19rem_1fr] md:items-start">
            {/* ── left: the point itself — who it is, what you can do, its data — in one card ── */}
            <section className="panel fade-up p-4 md:sticky md:top-20" aria-label="Details">
              <div className="mb-3 flex items-start justify-between gap-2">
                <NodeBadge type={focus.nodeType} />
                <div className="flex flex-none items-center gap-1">
                  <button type="button" onClick={navigation.back} className="btn btn-quiet text-[12.5px]" title="Go back (Backspace)">
                    ← Back
                  </button>
                  <button type="button" onClick={share} className="btn btn-quiet text-[12.5px]" title="Copy a link to this view">
                    {copied ? 'Link copied' : 'Share'}
                  </button>
                </div>
              </div>
              <h1 className="title-reveal text-[24px] leading-tight">{focus.label}</h1>
              <p className="mb-3 text-[13px] text-ink-dim">
                {focus.subtitle ? `${focus.subtitle} · ` : ''}
                {DEPTH_LABEL[depth]}
                {truncated ? ' · partial' : ''}
                {filtered ? ' · filtered' : ''}
              </p>
              <OwnButton node={focus} className="mb-3" />
              {focus.imageUrl ? (
                <div className="mb-3 flex justify-center">
                  <NodeImage
                    node={focus}
                    className={isCard ? 'img-frame w-40 rounded-lg' : 'max-h-16 object-contain'}
                    loading="eager"
                    placeholder={null}
                  />
                </div>
              ) : null}
              <Facts rows={details} />
              {description ? <Collapsible label="In the words of the card">{description}</Collapsible> : null}
              {focus.nodeType === 'card_printing' && other.status !== 'idle' ? (
                <div className="mt-3 border-t border-ink/10 pt-3">
                  <h2 className="eyebrow mb-1.5 flex items-center justify-between">
                    <span>Also printed in</span>
                    {other.status === 'ready' ? <span className="count">{other.printings.length}</span> : null}
                  </h2>
                  {other.status === 'loading' ? <p className="breathe text-[12.5px] text-ink-dim">Looking…</p> : null}
                  {other.status === 'ready' && other.printings.length === 0 ? (
                    <p className="text-[12.5px] text-ink-dim">Only printing in the catalog.</p>
                  ) : null}
                  <ChipList
                    nodes={other.printings}
                    hrefFor={hrefFor}
                    go={go}
                    limit={8}
                    label={(n) => `${String(n.metadata.setName ?? n.subtitle ?? '')}${typeof n.metadata.releaseDate === 'string' ? ` · ${n.metadata.releaseDate.slice(0, 4)}` : ''}`}
                  />
                  {other.identityNodeId ? (
                    <a href={hrefFor(other.identityNodeId)} onClick={go(other.identityNodeId)} className="btn btn-quiet mt-1 text-[12.5px]">
                      See the card and all its printings →
                    </a>
                  ) : null}
                </div>
              ) : null}
            </section>

            {/* ── right: every connection, grouped, as chips ── */}
            <section className="panel fade-up p-4" aria-label="Connections">
              <div className="mb-2 flex items-baseline justify-between">
                <h2 className="serif text-[18px]">Connections</h2>
                <span className="text-[12px] text-ink-dim">
                  {groups.reduce((n, g) => n + g.total, 0)} · click any to make it the focus
                </span>
              </div>
              {groups.length === 0 ? <p className="text-[14px] text-ink-dim">No connections yet.</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.map((group, i) => (
                  <ConnectionGroup key={group.key} group={group} index={i} hrefFor={hrefFor} go={go} />
                ))}
              </div>
              {farther.length > 0 ? (
                <div className="mt-3 border-t border-ink/10 pt-3">
                  <h3 className="eyebrow mb-1.5">
                    Further away <span className="font-normal">· two or three steps from {focus.label}</span>
                  </h3>
                  <ChipList nodes={farther} hrefFor={hrefFor} go={go} limit={24} />
                </div>
              ) : null}
            </section>
          </div>
        )}
      </div>
    </main>
  )
}

function Collapsible({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 border-t border-ink/10 pt-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="eyebrow flex w-full items-center justify-between" aria-expanded={open}>
        {label}
        <span className="font-normal">{open ? 'hide' : 'show'}</span>
      </button>
      {open ? <Prose className="mt-2">{children}</Prose> : null}
    </div>
  )
}

/** A connection as a chip: thumbnail, name, and (on hover) what it is. */
function Chip({ node, href, onClick, label }: { node: GraphNode; href: string; onClick: (e: React.MouseEvent) => void; label?: string }) {
  const colorOf = useNodeColor()
  const owned = useOwnershipStore((s) => s.ownedNodeIds.has(node.id))
  const element = elementOfNode(node)
  const logo = node.nodeType === 'set' || node.nodeType === 'series' || node.nodeType === 'game'
  return (
    <a
      href={href}
      onClick={onClick}
      className={`chip max-w-full text-[13px] ${owned ? 'chip-owned' : ''}`}
      title={`${NODE_TYPE_LABELS[node.nodeType]}${node.subtitle ? ` · ${node.subtitle}` : ''}${owned ? ' · in your constellation' : ''}`}
    >
      <NodeImage
        node={node}
        small
        alt=""
        loading="lazy"
        className={logo ? 'h-5 w-7 flex-none rounded-sm bg-node object-contain' : 'h-6 w-[18px] flex-none rounded-sm object-cover'}
        placeholder={element ? <ElementIcon element={element} size={15} /> : <span className="dot" style={{ color: colorOf(node.nodeType) }} aria-hidden />}
      />
      <span className="truncate">{label ?? node.label}</span>
    </a>
  )
}

function ChipList({
  nodes,
  hrefFor,
  go,
  limit,
  label,
}: {
  nodes: GraphNode[]
  hrefFor: (id: string) => string
  go: Go
  limit: number
  label?: (n: GraphNode) => string
}) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? nodes : nodes.slice(0, limit)
  if (nodes.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((n, i) => (
        <span key={n.id} className="pop-in min-w-0 max-w-full" style={{ '--i': Math.min(i, 14) } as React.CSSProperties}>
          <Chip node={n} href={hrefFor(n.id)} onClick={go(n.id, true)} label={label?.(n)} />
        </span>
      ))}
      {nodes.length > limit ? (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="chip text-[12.5px]">
          {expanded ? 'Show less' : `+${nodes.length - limit} more`}
        </button>
      ) : null}
    </div>
  )
}

function ConnectionGroup({ group, index, hrefFor, go }: { group: RelationshipGroup; index: number; hrefFor: (id: string) => string; go: Go }) {
  const theme = useTheme()
  const lineColor = edgeColor(theme, group.relationshipType)
  const wide = group.items.length > 8
  return (
    <section className={`pop-in min-w-0 ${wide ? 'sm:col-span-2' : ''}`} style={{ '--i': index } as React.CSSProperties} aria-label={group.label}>
      <h3 className="eyebrow mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-4 rounded-full" style={{ background: lineColor }} aria-hidden />
          {group.label}
        </span>
        <span className="count">{group.total}</span>
      </h3>
      <ChipList
        nodes={group.items.map((i) => i.node)}
        hrefFor={hrefFor}
        go={go}
        limit={wide ? 24 : 8}
        label={(n) => {
          const meta = group.items.find((i) => i.node.id === n.id)?.metadata
          return typeof meta?.value === 'string' ? `${n.label} ${meta.value}` : n.label
        }}
      />
      {group.total > group.items.length ? (
        <p className="mt-1 text-[12px] text-ink-dim">
          {group.items.length} of {group.total} shown — widen to Extended or Deep (bottom right) or use filters for the rest
        </p>
      ) : null}
    </section>
  )
}

/** Before any search: the game's series and their sets, newest first, in one panel. */
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
  go: Go
}) {
  return (
    <section className="panel fade-up mt-3 p-4" aria-label="Series and sets">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="serif text-[18px]">Series and sets</h2>
        <span className="text-[12px] text-ink-dim">newest first · pick a set to see its cards</span>
      </div>
      <div className="space-y-4">
        {series.map((s, i) => {
          const sets = bySeries.get(s.id) ?? []
          return (
            <section key={s.id} className="pop-in" style={{ '--i': Math.min(i, 20) } as React.CSSProperties} aria-label={s.label}>
              <a href={hrefFor(s.id)} onClick={go(s.id)} className="mb-1.5 flex min-w-0 items-center gap-2">
                <NodeImage node={s} small alt="" loading="lazy" className="h-7 w-10 flex-none rounded-sm bg-node object-contain p-0.5" placeholder={null} />
                <span className="serif truncate text-[17px]">{s.label}</span>
                <span className="text-[12px] text-ink-dim">
                  {sets.length} {sets.length === 1 ? 'set' : 'sets'}
                  {typeof s.metadata.releaseDate === 'string' ? ` · since ${s.metadata.releaseDate.slice(0, 4)}` : ''}
                </span>
              </a>
              <ChipList
                nodes={sets}
                hrefFor={hrefFor}
                go={go}
                limit={30}
                label={(set) => `${set.label}${typeof set.metadata.releaseDate === 'string' ? ` · ${set.metadata.releaseDate.slice(0, 4)}` : ''}`}
              />
            </section>
          )
        })}
        {orphanSets.length > 0 ? (
          <section aria-label="Other sets">
            <h3 className="eyebrow mb-1.5">Other sets</h3>
            <ChipList nodes={orphanSets} hrefFor={hrefFor} go={go} limit={30} />
          </section>
        ) : null}
      </div>
    </section>
  )
}
