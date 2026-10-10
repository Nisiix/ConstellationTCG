'use client'

import { useMemo, useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { formatDate } from '@/lib/dates'
import type { Lineage } from '@/lib/lineage-view'
import { LINEAGE_SKY_PRINTINGS_PER_SET } from '@/lib/lineage-view'
import { prettySharePath } from '@/lib/pretty-url'
import { edgeColor, useTheme } from '@/lib/theme'
import { buildExploreUrl } from '@/lib/url'
import { useLensStore } from '@/state/lens-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useTimeStore } from '@/state/time-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'
import { NodeImage } from './NodeImage'

/** Points the lineage can open from: a card, a printing, or what a card shows (any point that is not structure). */
const NO_LINEAGE = new Set(['game', 'series', 'set', 'artist', 'digital_asset', 'mechanic', 'attribute'])

export function hasLineage(node: Pick<GraphNode, 'nodeType'>): boolean {
  return !NO_LINEAGE.has(node.nodeType)
}

/** The button that opens a point's lineage, in the focus panel and in the list. */
export function LineageButton({ node, className = '' }: { node: GraphNode; className?: string }) {
  const navigation = useExploreNavigation()
  if (!hasLineage(node)) return null
  return (
    <a
      href={buildExploreUrl({ ...navigation.current, node: node.id, path: null, pathMax: null, panel: null, lens: 'lineage' })}
      onClick={(e) => {
        e.preventDefault()
        navigation.openLineage(node.id)
      }}
      className={`btn btn-ghost pill text-[12.5px] ${className}`}
      title="Its evolution line, every printing along time, the artists who drew it (G)"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="6" r="2.5" />
        <circle cx="12" cy="18" r="2.5" />
        <path d="M6 8.5v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-2M12 13.5v2" />
      </svg>
      Genealogy
    </a>
  )
}

function yearSpan(first: number | null, last: number | null): string {
  if (first === null) return ''
  return last === null || last === first ? String(first) : `${first}–${last}`
}

/** Under the cursor of time: what is not in the sky yet is left out, what is new that year is marked. */
function useTimeMarks() {
  const hidden = useTimeStore((s) => s.hidden)
  const fresh = useTimeStore((s) => s.fresh)
  const year = useTimeStore((s) => s.year)
  return { hidden, fresh, year }
}

function useShare(node: GraphNode | null) {
  const navigation = useExploreNavigation()
  const [copied, setCopied] = useState(false)
  const share = async () => {
    try {
      const pretty = node ? prettySharePath(node, navigation.current) : null
      await navigator.clipboard.writeText(pretty && !navigation.current.lens ? `${window.location.origin}${pretty}` : navigation.shareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }
  return { copied, share }
}

/** "First printed 09-01-1999 in Base Set · 12 printings in 8 expansions · 5 artists". */
function summary(lineage: Lineage): string {
  const parts: string[] = []
  const first = lineage.first
  if (first) {
    const date = formatDate(typeof first.metadata.releaseDate === 'string' ? first.metadata.releaseDate : null)
    const set = typeof first.metadata.setName === 'string' ? first.metadata.setName : null
    parts.push(`First printed${date ? ` ${date}` : ''}${set ? ` in ${set}` : ''}`)
  }
  parts.push(`${lineage.printingCount} ${lineage.printingCount === 1 ? 'printing' : 'printings'} in ${lineage.setCount} ${lineage.setCount === 1 ? 'expansion' : 'expansions'}`)
  if (lineage.artists.length) parts.push(`${lineage.artists.length} ${lineage.artists.length === 1 ? 'artist' : 'artists'}`)
  return parts.join(' · ')
}

function Header({ lineage, variant }: { lineage: Lineage; variant: 'panel' | 'page' }) {
  const navigation = useExploreNavigation()
  const { copied, share } = useShare(lineage.subject)
  const from = lineage.from.id !== lineage.subject.id ? lineage.from : null
  return (
    <div className={variant === 'panel' ? 'p-5 pb-3' : ''}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="eyebrow">Genealogy</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => navigation.closeLens(lineage.from.id)} className="btn btn-quiet text-[12.5px]" title="Back to the sky around this point">
            ← Back to the sky
          </button>
          <button type="button" onClick={share} className="btn btn-quiet text-[12.5px]" title="Copy a link to this genealogy">
            {copied ? 'Link copied' : 'Share'}
          </button>
        </div>
      </div>
      <h1 className="title-reveal text-[24px] leading-tight text-ink">{lineage.subject.label}</h1>
      <p className="mt-1 text-[13px] text-ink-dim" data-testid="lineage-summary">
        {summary(lineage)}
      </p>
      {from ? <p className="mt-1 text-[12px] text-ink-dim">Opened from {from.label}{from.subtitle ? ` · ${from.subtitle}` : ''}</p> : null}
    </div>
  )
}

/** The evolution line as a row: base on the left, the subject pressed; each one opens its own genealogy. */
function FamilyRow({ lineage }: { lineage: Lineage }) {
  const navigation = useExploreNavigation()
  const theme = useTheme()
  const stages = useMemo(() => {
    const byStage = new Map<number, Lineage['family']>()
    for (const m of lineage.family) byStage.set(m.stage, [...(byStage.get(m.stage) ?? []), m])
    return [...byStage.entries()].sort((a, b) => a[0] - b[0])
  }, [lineage.family])
  if (stages.length === 0) return null
  return (
    <section aria-label="Evolution line">
      <h2 className="eyebrow mb-1.5 flex items-center gap-2">
        <span className="inline-block h-[2px] w-4 rounded-full" style={{ background: edgeColor(theme, 'EVOLUTION_OF') }} aria-hidden />
        Evolution line
      </h2>
      <ol className="flex flex-wrap items-center gap-1.5">
        {stages.map(([stage, members], i) => (
          <li key={stage} className="flex items-center gap-1.5">
            {i > 0 ? (
              <span className="text-ink-dim" aria-hidden>
                →
              </span>
            ) : null}
            <span className="flex flex-col gap-1">
              {members.map((m) => {
                const current = m.node.id === lineage.subject.id
                return (
                  <a
                    key={m.node.id}
                    href={buildExploreUrl({ ...navigation.current, node: m.node.id, lens: 'lineage', panel: null })}
                    onClick={(e) => {
                      e.preventDefault()
                      if (!current) navigation.openLineage(m.node.id)
                    }}
                    aria-current={current ? 'true' : undefined}
                    className={`chip text-[13px] ${current ? 'chip-on' : ''}`}
                    title={current ? 'This genealogy' : `The genealogy of ${m.node.label}`}
                  >
                    <NodeImage node={m.node} small alt="" loading="lazy" className="h-6 w-[18px] flex-none rounded-sm object-cover" placeholder={null} />
                    {m.node.label}
                  </a>
                )
              })}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Artists({ lineage, limit }: { lineage: Lineage; limit: number }) {
  const navigation = useExploreNavigation()
  const theme = useTheme()
  const { hidden, fresh } = useTimeMarks()
  const setHighlight = useUiStore((s) => s.setHighlight)
  const [all, setAll] = useState(false)
  const artists = lineage.artists.filter((a) => !hidden.has(a.node.id))
  if (artists.length === 0) return null
  const shown = all ? artists : artists.slice(0, limit)
  return (
    <section aria-label="Artists">
      <h2 className="eyebrow mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="inline-block h-[2px] w-4 rounded-full" style={{ background: edgeColor(theme, 'ILLUSTRATED_BY') }} aria-hidden />
          Drawn by
        </span>
        <span className="count">{artists.length}</span>
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((a) => (
          <a
            key={a.node.id}
            href={buildExploreUrl({ ...navigation.current, node: a.node.id, lens: null, panel: null })}
            onClick={(e) => {
              e.preventDefault()
              navigation.goTo(a.node.id)
            }}
            onMouseEnter={() => setHighlight([a.node.id])}
            onMouseLeave={() => setHighlight(null)}
            className={`chip text-[13px] ${fresh.has(a.node.id) ? 'chip-fresh' : ''}`}
            title={`${a.count} ${a.count === 1 ? 'printing' : 'printings'}${a.firstYear ? `, ${yearSpan(a.firstYear, a.lastYear)}` : ''}`}
          >
            <span className="truncate">{a.node.label}</span>
            <span className="text-[11.5px] text-ink-dim">{yearSpan(a.firstYear, a.lastYear) || a.count}</span>
          </a>
        ))}
        {artists.length > shown.length ? (
          <button type="button" className="chip text-[12.5px]" onClick={() => setAll(true)}>
            Show all {artists.length}
          </button>
        ) : null}
      </div>
    </section>
  )
}

/** The eras, newest first: a series, then each of its expansions with the year and its printings. */
function Timeline({ lineage, variant }: { lineage: Lineage; variant: 'panel' | 'page' }) {
  const navigation = useExploreNavigation()
  const { hidden, fresh } = useTimeMarks()
  const owned = useOwnershipStore((s) => s.ownedNodeIds)
  const setHighlight = useUiStore((s) => s.setHighlight)
  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    navigation.goTo(id, { follow: true })
  }
  const href = (id: string) => buildExploreUrl({ ...navigation.current, node: id, lens: null, panel: null })
  const eras = lineage.eras
    .map((era) => ({ ...era, sets: era.sets.filter((s) => !hidden.has(s.set.id)) }))
    .filter((era) => era.sets.length > 0)
  if (eras.length === 0) return <p className="text-[13px] text-ink-dim">Not printed yet at this point in time.</p>
  const perSet = variant === 'page' ? 24 : 4
  return (
    <section aria-label="Along time">
      <h2 className="eyebrow mb-2 flex items-center justify-between">
        <span>Along time</span>
        <span className="font-normal">newest first</span>
      </h2>
      <div className="space-y-4">
        {eras.map((era, i) => {
          const years = era.sets.map((s) => s.year).filter((y): y is number => y !== null)
          return (
            <section key={era.series?.id ?? `era-${i}`} aria-label={era.series?.label ?? 'Other expansions'}>
              {era.series ? (
                <a href={href(era.series.id)} onClick={go(era.series.id)} className="mb-1.5 flex min-w-0 items-center gap-2" onMouseEnter={() => setHighlight([era.series!.id, ...era.sets.map((s) => s.set.id)])} onMouseLeave={() => setHighlight(null)}>
                  <NodeImage node={era.series} small alt="" loading="lazy" className="h-6 w-9 flex-none rounded-sm bg-node object-contain p-0.5" placeholder={null} />
                  <span className="serif truncate text-[16px]">{era.series.label}</span>
                  <span className="text-[12px] text-ink-dim">{yearSpan(years.length ? Math.min(...years) : null, years.length ? Math.max(...years) : null)}</span>
                </a>
              ) : (
                <h3 className="eyebrow mb-1.5">Other expansions</h3>
              )}
              <ol className="timeline space-y-2.5">
                {era.sets.map((entry) => {
                  const printings = entry.printings.filter((p) => !hidden.has(p.id))
                  const isFresh = fresh.has(entry.set.id)
                  return (
                    <li key={entry.set.id} className="relative" onMouseEnter={() => setHighlight([entry.set.id, ...printings.map((p) => p.id)])} onMouseLeave={() => setHighlight(null)}>
                      <span className="timeline-dot" aria-hidden />
                      <a href={href(entry.set.id)} onClick={go(entry.set.id)} className="flex min-w-0 items-baseline gap-2" data-node-id={entry.set.id}>
                        <span className="w-10 flex-none text-[12px] tabular-nums text-ink-dim">{entry.year ?? '—'}</span>
                        <span className="min-w-0 truncate text-[14px]">{entry.set.label}</span>
                        {isFresh ? <span className="fresh-mark">new</span> : null}
                        <span className="count ml-auto flex-none">{printings.length}</span>
                      </a>
                      <div className="mt-1 flex flex-wrap gap-1 pl-12">
                        {printings.slice(0, perSet).map((p) => (
                          <a
                            key={p.id}
                            href={href(p.id)}
                            onClick={go(p.id)}
                            className={`rounded ${owned.has(p.id) ? 'ring-1 ring-[var(--c-own)]' : ''}`}
                            title={`${p.label} · ${String(p.metadata.printedNumber ?? p.metadata.collectorNumber ?? '')}${typeof p.metadata.rarity === 'string' ? ` · ${p.metadata.rarity}` : ''}`}
                          >
                            <NodeImage node={p} small alt={p.label} loading="lazy" className={`img-frame flex-none rounded object-cover ${variant === 'page' ? 'h-16 w-[46px]' : 'h-10 w-7'}`} />
                          </a>
                        ))}
                        {printings.length > perSet ? (
                          <a href={href(entry.set.id)} onClick={go(entry.set.id)} className="chip self-center text-[12px]" title={`Open ${entry.set.label}`}>
                            +{printings.length - perSet}
                          </a>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })}
      </div>
      {lineage.truncated ? (
        <p className="mt-3 text-[12px] text-ink-dim">The oldest {lineage.printings.length} of {lineage.printingCount} printings are listed.</p>
      ) : null}
    </section>
  )
}

/** In the sky: the lineage panel on the right (the timeline itself is drawn in the scene). */
export function LineagePanel() {
  const lineage = useLensStore((s) => s.lineage)
  const setHighlight = useUiStore((s) => s.setHighlight)
  if (!lineage) return null
  return (
    <aside
      id="lineage-panel"
      aria-label="Genealogy"
      key={lineage.subject.id}
      className="panel scroll-thin fade-up absolute right-4 top-16 z-30 flex max-h-[calc(100vh-9rem)] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto"
      onMouseLeave={() => setHighlight(null)}
    >
      <Header lineage={lineage} variant="panel" />
      <div className="space-y-4 border-t border-ink/10 px-5 py-4">
        <p className="text-[12px] text-ink-dim">
          In the sky: the evolution line on top, the expansions from the oldest (left) to the newest, up to {LINEAGE_SKY_PRINTINGS_PER_SET} printings each, the artists below.
        </p>
        <FamilyRow lineage={lineage} />
        <Timeline lineage={lineage} variant="panel" />
        <Artists lineage={lineage} limit={10} />
      </div>
    </aside>
  )
}

/** In the list: the whole lineage on one page, the point on the left and time on the right. */
export function LineagePage() {
  const lineage = useLensStore((s) => s.lineage)
  if (!lineage) return null
  const picture = lineage.first ?? lineage.subject
  return (
    <main id="lineage-page" aria-label="Genealogy" className="scroll-thin absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto px-4 pb-40 pt-3">
      <div className="mx-auto grid w-full max-w-6xl gap-3 md:grid-cols-[20rem_1fr] md:items-start">
        <section className="panel fade-up space-y-4 p-4 md:sticky md:top-20" aria-label="Who">
          <Header lineage={lineage} variant="page" />
          {picture.imageUrl ? (
            <div className="flex justify-center">
              <NodeImage node={picture} className="img-frame w-40 rounded-lg" loading="eager" />
            </div>
          ) : null}
          <FamilyRow lineage={lineage} />
          <Artists lineage={lineage} limit={16} />
        </section>
        <section className="panel fade-up p-4">
          <Timeline lineage={lineage} variant="page" />
        </section>
      </div>
    </main>
  )
}
