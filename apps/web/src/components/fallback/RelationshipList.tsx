'use client'

import { useMemo, useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { groupFarNodes, type FarSection } from '@/lib/connections'
import { formatDate } from '@/lib/dates'
import { detailRows } from '@/lib/details'
import { prettySharePath } from '@/lib/pretty-url'
import { edgeColor, useNodeColor, useTheme } from '@/lib/theme'
import { buildExploreUrl, type ExplorePanel } from '@/lib/url'
import { useGraphStore } from '@/state/graph-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useExploreNavigation } from '../navigation'
import { useOtherPrintings } from '../useOtherPrintings'
import { useRelationshipGroups, type RelationshipGroup } from '../useRelationshipGroups'
import { ElementIcon, elementOfNode } from '../ui/ElementIcon'
import { Details, Prose } from '../ui/Details'
import { NodeBadge } from '../ui/NodeBadge'
import { NodeImage } from '../ui/NodeImage'
import { OwnButton } from '../ui/OwnButton'
import { ConnectTo } from '../ui/ConnectTo'
import { ConnectionList } from '../ui/ConnectionList'
import { LandmarksButton } from '../ui/LandmarksView'
import { LineageButton } from '../ui/LineageView'
import { useTimeStore } from '@/state/time-store'

type Go = (id: string, follow?: boolean) => (e: React.MouseEvent) => void

/** "Show all": a link to the page that lists every connection of a kind (and Back returns here). */
interface ShowAll {
  href: string
  open: (e: React.MouseEvent) => void
  /** How many the page lists, when known (a far section only knows the few it reached). */
  total: number | null
}

/** `Base Set` + `1999-01-09` → `Base Set · 09-01-1999`; no date, no suffix. */
function withDate(label: string, date: unknown): string {
  const formatted = formatDate(typeof date === 'string' ? date : null)
  return formatted ? `${label} · ${formatted}` : label
}

/** What a chip says on hover: the kind (unless the chip's picture and subtitle already say it), the subtitle, ownership. */
function chipTitle(node: GraphNode, owned: boolean): string {
  const parts = [node.nodeType === 'card_printing' ? null : NODE_TYPE_LABELS[node.nodeType], node.subtitle, owned ? 'in your constellation' : null]
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

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
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const truncated = useGraphStore((s) => s.truncated)
  const filtered = useGraphStore((s) => s.filtered)
  const other = useOtherPrintings(focus)
  const [copied, setCopied] = useState(false)
  const hiddenInTime = useTimeStore((s) => s.hidden)
  const freshInTime = useTimeStore((s) => s.fresh)
  const year = useTimeStore((s) => s.year)

  const current = navigation.current
  const hrefFor = (nodeId: string) => buildExploreUrl({ ...current, path: null, pathMax: null, panel: null, node: nodeId, depth: 1 })
  const showAll = (panel: Extract<ExplorePanel, { kind: 'list' }>, total: number | null): ShowAll => ({
    href: buildExploreUrl({ ...current, panel }),
    open: (e) => {
      e.preventDefault()
      navigation.openPanel(panel)
    },
    total,
  })

  const universe = useMemo(() => {
    if (!isUniverse) return null
    const byRelease = (a: GraphNode, b: GraphNode) =>
      String(b.metadata.releaseDate ?? '').localeCompare(String(a.metadata.releaseDate ?? '')) || a.label.localeCompare(b.label)
    // Expansions from the most recent to the oldest.
    // Under the time cursor: only what was out by then.
    const inTime = (n: GraphNode) => !hiddenInTime.has(n.id)
    const series = nodes.filter((n) => n.nodeType === 'series' && inTime(n)).sort(byRelease)
    const sets = nodes.filter((n) => n.nodeType === 'set' && inTime(n)).sort(byRelease)
    const seriesOfSet = new Map<string, string>()
    for (const e of edges) if (e.relationshipType === 'PART_OF') seriesOfSet.set(e.sourceNodeId, e.targetNodeId)
    const bySeries = new Map<string, GraphNode[]>()
    for (const set of sets) {
      const key = seriesOfSet.get(set.id) ?? 'other'
      const list = bySeries.get(key) ?? []
      list.push(set)
      bySeries.set(key, list)
    }
    return { series, bySeries, orphanSets: bySeries.get('other') ?? [], fresh: sets.filter((s) => freshInTime.has(s.id)) }
  }, [isUniverse, nodes, edges, hiddenInTime, freshInTime])

  // Two or three steps away, sectioned by the direct connection that leads there.
  const farSections = useMemo(() => {
    if (!focus) return []
    const shown = hiddenInTime.size ? nodes.filter((n) => !hiddenInTime.has(n.id)) : nodes
    return groupFarNodes(shown, edges, distances, focus.id)
  }, [focus, nodes, edges, distances, hiddenInTime])

  if (!focus) return null

  if (current.panel?.kind === 'list') {
    return (
      <main id="relationship-list" aria-label="List view" className="scroll-thin absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto px-4 pb-24 pt-3">
        <div className="mx-auto w-full max-w-6xl">
          <ConnectionList key={JSON.stringify(current.panel)} panel={current.panel} variant="page" />
        </div>
      </main>
    )
  }

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
  const details = detailRows(focus, edges)
  // A card's headline ("Base Set · 4/102 · Rare · Holo") says what its subtitle would repeat.
  const hasHeadline = details.some((row) => row.group === 'print')
  const description = typeof focus.metadata.description === 'string' ? focus.metadata.description : null
  // Under the name: the subtitle (unless the details headline says it) and only the flags that are not obvious.
  const meta = [hasHeadline ? null : focus.subtitle, truncated ? 'partial' : null, filtered ? 'filtered' : null].filter(Boolean).join(' · ')

  return (
    <main id="relationship-list" aria-label="List view" className={`scroll-thin absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto px-4 pt-3 ${year !== null ? 'pb-40' : 'pb-24'}`}>
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
              <div className="flex flex-none items-center gap-1">
                <LandmarksButton />
                <button type="button" onClick={share} className="btn btn-ghost">
                  {copied ? 'Link copied' : 'Share'}
                </button>
              </div>
            </header>
            {year !== null ? (
              <section className="panel fade-up mt-3 p-4" aria-label={`New in ${year}`}>
                <h2 className="serif mb-2 text-[18px]">
                  New in {year} <span className="count align-middle">{universe.fresh.length}</span>
                </h2>
                {universe.fresh.length === 0 ? <p className="text-[13px] text-ink-dim">No new expansion that year.</p> : null}
                <ChipList nodes={universe.fresh} hrefFor={hrefFor} go={go} limit={40} label={(set) => withDate(set.label, set.metadata.releaseDate)} />
              </section>
            ) : null}
            <UniverseCatalog
              series={universe.series}
              bySeries={universe.bySeries}
              orphanSets={universe.orphanSets}
              hrefFor={hrefFor}
              go={go}
              showAllOf={(series, total) => showAll({ kind: 'list', relationshipType: 'PART_OF', direction: 'in', of: series.id }, total)}
            />
          </>
        ) : (
          <div className="grid gap-3 md:grid-cols-[19rem_1fr] md:items-start">
            {/* ── left: the point itself — who it is, what you can do, its data — in one card ── */}
            <section className="panel fade-up p-4 md:sticky md:top-20" aria-label="Details">
              <div className="mb-3 flex items-start justify-between gap-2">
                {/* a card's picture and "Base Set · 4/102" already say it is a printing */}
                {focus.nodeType !== 'card_printing' ? <NodeBadge type={focus.nodeType} /> : null}
                <div className="ml-auto flex flex-none items-center gap-1">
                  <button type="button" onClick={navigation.back} className="btn btn-quiet text-[12.5px]" title="Go back (Backspace)">
                    ← Back
                  </button>
                  <button type="button" onClick={share} className="btn btn-quiet text-[12.5px]" title="Copy a link to this view">
                    {copied ? 'Link copied' : 'Share'}
                  </button>
                </div>
              </div>
              <h1 className="title-reveal text-[24px] leading-tight">{focus.label}</h1>
              {meta ? (
                <p className="mb-3 text-[13px] text-ink-dim" title={truncated ? 'Large hubs are capped: not every connection is listed' : undefined}>
                  {meta}
                </p>
              ) : (
                <div className="mb-3" aria-hidden />
              )}
              <div className="mb-3 flex flex-wrap items-start gap-2">
                <OwnButton node={focus} />
                <LineageButton node={focus} />
                <ConnectTo node={focus} className="min-w-0 flex-1" />
              </div>
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
              <Details rows={details} hrefFor={hrefFor} onSelect={(id) => navigation.goTo(id)} />
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
                    label={(n) => withDate(String(n.metadata.setName ?? n.subtitle ?? ''), n.metadata.releaseDate)}
                    showAll={
                      other.identityNodeId
                        ? showAll({ kind: 'list', relationshipType: 'PRINTING_OF', direction: 'in', of: other.identityNodeId }, other.printings.length + 1)
                        : undefined
                    }
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
              <h2 className="serif mb-2 text-[18px]">Connections</h2>
              {groups.length === 0 ? <p className="text-[14px] text-ink-dim">No connections yet.</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {groups.map((group, i) => (
                  <ConnectionGroup
                    key={group.key}
                    group={group}
                    index={i}
                    hrefFor={hrefFor}
                    go={go}
                    showAll={showAll({ kind: 'list', relationshipType: group.relationshipType, direction: group.direction, of: null }, group.total)}
                  />
                ))}
              </div>
              {farSections.length > 0 ? (
                <div className="mt-3 border-t border-ink/10 pt-3">
                  <h3 className="eyebrow mb-2">
                    Further away <span className="font-normal">· two steps from {focus.label}</span>
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {farSections.map((section, i) => (
                      <FarSectionView
                        key={section.key}
                        section={section}
                        index={i}
                        hrefFor={hrefFor}
                        go={go}
                        showAll={
                          section.bridge && section.bridgeIs
                            ? showAll(
                                {
                                  kind: 'list',
                                  relationshipType: section.relationshipType,
                                  direction: section.bridgeIs === 'target' ? 'in' : 'out',
                                  of: section.bridge.id,
                                },
                                null,
                              )
                            : undefined
                        }
                      />
                    ))}
                  </div>
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
  const fresh = useTimeStore((s) => s.fresh.has(node.id))
  const element = elementOfNode(node)
  const logo = node.nodeType === 'set' || node.nodeType === 'series' || node.nodeType === 'game'
  return (
    <a
      href={href}
      onClick={onClick}
      className={`chip max-w-full text-[13px] ${owned ? 'chip-owned' : fresh ? 'chip-fresh' : ''}`}
      title={chipTitle(node, owned)}
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
      {fresh ? <span className="fresh-mark">new</span> : null}
    </a>
  )
}

/**
 * Chips for a handful of connections. Past `limit`, a "Show all" chip opens every one of them on a
 * page of its own instead of growing the list in place.
 */
function ChipList({
  nodes,
  hrefFor,
  go,
  limit,
  label,
  showAll,
}: {
  nodes: GraphNode[]
  hrefFor: (id: string) => string
  go: Go
  limit: number
  label?: (n: GraphNode) => string
  showAll?: ShowAll
}) {
  const shown = nodes.slice(0, limit)
  if (nodes.length === 0) return null
  const total = showAll?.total === null ? null : Math.max(showAll?.total ?? 0, nodes.length)
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((n, i) => (
        <span key={n.id} className="pop-in min-w-0 max-w-full" style={{ '--i': Math.min(i, 14) } as React.CSSProperties}>
          <Chip node={n} href={hrefFor(n.id)} onClick={go(n.id, true)} label={label?.(n)} />
        </span>
      ))}
      {showAll && (total === null ? nodes.length > shown.length : total > shown.length) ? (
        <a href={showAll.href} onClick={showAll.open} className="chip text-[12.5px]" title="Every one of them, on a page of its own">
          {total === null ? 'Show all →' : `Show all ${total} →`}
        </a>
      ) : null}
    </div>
  )
}

function ConnectionGroup({
  group,
  index,
  hrefFor,
  go,
  showAll,
}: {
  group: RelationshipGroup
  index: number
  hrefFor: (id: string) => string
  go: Go
  showAll: ShowAll
}) {
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
        showAll={showAll}
      />
    </section>
  )
}

/** A far section: the bridge and the kind of connection in the heading (with the color of its lines), the points as chips. */
function FarSectionView({
  section,
  index,
  hrefFor,
  go,
  showAll,
}: {
  section: FarSection
  index: number
  hrefFor: (id: string) => string
  go: Go
  showAll?: ShowAll
}) {
  const theme = useTheme()
  const lineColor = edgeColor(theme, section.relationshipType)
  const wide = section.nodes.length > 8
  return (
    <section className={`pop-in min-w-0 ${wide ? 'sm:col-span-2' : ''}`} style={{ '--i': Math.min(index, 14) } as React.CSSProperties} aria-label={section.label}>
      <h4 className="eyebrow mb-1.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-block h-[2px] w-4 flex-none rounded-full" style={{ background: lineColor }} aria-hidden />
          <span className="truncate">{section.label}</span>
        </span>
        <span className="count">{section.nodes.length}</span>
      </h4>
      <ChipList nodes={section.nodes} hrefFor={hrefFor} go={go} limit={wide ? 24 : 12} showAll={showAll} />
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
  showAllOf,
}: {
  series: GraphNode[]
  bySeries: Map<string, GraphNode[]>
  orphanSets: GraphNode[]
  hrefFor: (id: string) => string
  go: Go
  showAllOf: (series: GraphNode, total: number) => ShowAll
}) {
  return (
    <section className="panel fade-up mt-3 p-4" aria-label="Series and sets">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="serif text-[18px]">Series and sets</h2>
        <span className="text-[12px] text-ink-dim">newest first</span>
      </div>
      <div className="space-y-4">
        {series.map((s, i) => {
          const sets = bySeries.get(s.id) ?? []
          const since = formatDate(typeof s.metadata.releaseDate === 'string' ? s.metadata.releaseDate : null)
          return (
            <section key={s.id} className="pop-in" style={{ '--i': Math.min(i, 20) } as React.CSSProperties} aria-label={s.label}>
              <a href={hrefFor(s.id)} onClick={go(s.id)} className="mb-1.5 flex min-w-0 items-center gap-2">
                <NodeImage node={s} small alt="" loading="lazy" className="h-7 w-10 flex-none rounded-sm bg-node object-contain p-0.5" placeholder={null} />
                <span className="serif truncate text-[17px]">{s.label}</span>
                <span className="text-[12px] text-ink-dim">
                  {sets.length} {sets.length === 1 ? 'set' : 'sets'}
                  {since ? ` · since ${since}` : ''}
                </span>
              </a>
              <ChipList
                nodes={sets}
                hrefFor={hrefFor}
                go={go}
                limit={30}
                label={(set) => withDate(set.label, set.metadata.releaseDate)}
                showAll={showAllOf(s, sets.length)}
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
