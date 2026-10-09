'use client'

import { useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { detailRows } from '@/lib/details'
import { prettySharePath } from '@/lib/pretty-url'
import { edgeColor, useNodeColor, useTheme } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'
import { useOtherPrintings } from '../useOtherPrintings'
import { useRelationshipGroups, type RelationshipGroup } from '../useRelationshipGroups'
import { ElementIcon, elementOfNode } from './ElementIcon'
import { Facts, Prose } from './Facts'
import { NodeBadge } from './NodeBadge'
import { NodeImage } from './NodeImage'
import { OwnButton } from './OwnButton'

const DEPTH_LABEL: Record<number, string> = { 1: 'direct connections', 2: 'extended connections', 3: 'deep connections' }

export function FocusPanel() {
  const navigation = useExploreNavigation()
  const { focus, groups } = useRelationshipGroups()
  const depth = useGraphStore((s) => s.depth)
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const setCount = useGraphStore((s) => s.nodes.reduce((n, node) => n + (node.nodeType === 'set' ? 1 : 0), 0))
  const truncated = useGraphStore((s) => s.truncated)
  const filtered = useGraphStore((s) => s.filtered)
  const welcomeVisible = useUiStore((s) => s.welcomeVisible)
  const setHighlight = useUiStore((s) => s.setHighlight)
  const other = useOtherPrintings(focus)
  const [copied, setCopied] = useState(false)
  /** `connections` (default) or `details`: the card's data on its own page, with a way back. */
  const [view, setView] = useState<'connections' | 'details'>('connections')

  // On the first visit the welcome card takes the stage; the game panel returns once dismissed.
  if (!focus || (welcomeVisible && isUniverse)) return null

  const isCard = focus.nodeType === 'card_printing' || focus.nodeType === 'card_identity'
  const details = detailRows(focus)

  const share = async () => {
    try {
      // Printings and sets get their readable address; everything else the explorer link.
      const pretty = prettySharePath(focus, navigation.current)
      await navigator.clipboard.writeText(pretty ? `${window.location.origin}${pretty}` : navigation.shareUrl())
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
            {view === 'details' ? (
              <button type="button" onClick={() => setView('connections')} className="btn btn-quiet text-[12.5px]" title="Back to the connections">
                ← Back
              </button>
            ) : (
              <button type="button" onClick={navigation.back} className="btn btn-quiet text-[12.5px]" title="Go back (Backspace)">
                ← Back
              </button>
            )}
            <button type="button" onClick={share} className="btn btn-quiet text-[12.5px]" title="Copy a link to this view">
              {copied ? 'Link copied' : 'Share'}
            </button>
          </div>
        </div>
        <h1 className="title-reveal text-[24px] leading-tight text-ink">{focus.label}</h1>
        {focus.subtitle ? <p className="mt-0.5 text-[14px] text-ink-dim">{focus.subtitle}</p> : null}
        {view === 'connections' && (details.length > 0 || isCard) ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setView('details')} className="btn btn-ghost pill text-[12.5px]" title="Open the details of this point">
              Details
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
            <OwnButton node={focus} />
          </div>
        ) : null}
      </div>

      {view === 'details' ? (
        <div className="slide-in">
          <DetailsView focus={focus} details={details} other={other} isCard={isCard} onSelect={(id) => navigation.goTo(id, { follow: true })} />
        </div>
      ) : (
        <div className="slide-back">

      {focus.imageUrl && isCard ? (
        <button type="button" onClick={() => setView('details')} className="flex w-full justify-center bg-void/40 px-5 py-4" title="Open the details">
          <NodeImage node={focus} variant="card" className="img-frame fade-up w-36 rounded-lg" loading="eager" />
        </button>
      ) : focus.imageUrl && focus.nodeType !== 'game' ? (
        <div className="flex justify-center bg-void/40 px-5 py-4">
          <NodeImage node={focus} variant="logo" className="max-h-16 object-contain" loading="eager" placeholder={null} />
        </div>
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
        {isUniverse ? (
          <p className="mb-4 text-[13px] text-ink-dim">
            Pick a series or a set to dive in, or search for a card above.
            {setCount === 1 ? (
              <>
                {' '}
                Only the bundled Base Set is loaded for now: <code>pnpm ingest</code> then <code>pnpm graph:build</code> bring in every
                expansion and the reprints across sets.
              </>
            ) : null}
          </p>
        ) : null}
        {groups.length === 0 ? <p className="text-sm text-ink-dim">No connections yet.</p> : null}
        <div className="space-y-4">
          {groups.map((group, i) => (
            <div key={group.key} className="pop-in" style={{ '--i': i } as React.CSSProperties}>
              <RelationshipGroupView group={group} onSelect={(id) => navigation.goTo(id, { follow: true })} />
            </div>
          ))}
        </div>
      </div>
        </div>
      )}
    </aside>
  )
}

/** The point's own page: the full image, its data, its description and, for a card, its other printings. */
function DetailsView({
  focus,
  details,
  other,
  isCard,
  onSelect,
}: {
  focus: GraphNode
  details: Array<[string, string]>
  other: ReturnType<typeof useOtherPrintings>
  isCard: boolean
  onSelect: (nodeId: string) => void
}) {
  const meta = focus.metadata
  return (
    <div className="fade-up">
      {focus.imageUrl && isCard ? (
        <div className="flex justify-center bg-void/40 px-5 py-5">
          <NodeImage node={focus} variant="card" className="img-frame w-56 rounded-xl" loading="eager" />
        </div>
      ) : focus.imageUrl && focus.nodeType !== 'game' ? (
        <div className="flex justify-center bg-void/40 px-5 py-5">
          <NodeImage node={focus} variant="logo" className="max-h-24 object-contain" loading="eager" placeholder={null} />
        </div>
      ) : null}
      {details.length > 0 ? (
        <section className="border-t border-ink/10 px-5 py-4" aria-label="Details">
          <h2 className="serif mb-2 text-[17px]">Details</h2>
          <Facts rows={details} />
        </section>
      ) : null}
      {typeof meta.description === 'string' && meta.description ? (
        <section className="border-t border-ink/10 px-5 py-4" aria-label="Description">
          <h2 className="serif mb-2 text-[17px]">In the words of the card</h2>
          <Prose>{meta.description}</Prose>
        </section>
      ) : null}
      {focus.nodeType === 'card_printing' && other.status !== 'idle' ? <OtherPrintingsView other={other} onSelect={onSelect} /> : null}
    </div>
  )
}

function RelationshipGroupView({ group, onSelect }: { group: RelationshipGroup; onSelect: (nodeId: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const theme = useTheme()
  const colorOf = useNodeColor()
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)
  const setHighlight = useUiStore((s) => s.setHighlight)
  const owned = useOwnershipStore((s) => s.ownedNodeIds)
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
        <span className="count">{group.total}</span>
      </h3>
      <ul className="stagger space-y-0.5">
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
              <span className="dot" style={{ color: owned.has(node.id) ? theme.ownership : colorOf(node.nodeType) }} aria-hidden />
              {elementOfNode(node) ? <ElementIcon element={elementOfNode(node) as NonNullable<ReturnType<typeof elementOfNode>>} /> : null}
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              {owned.has(node.id) ? <span className="owned-mark">yours</span> : null}
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
          {group.items.length} of {group.total} shown — widen to Extended or Deep (bottom right) or use filters to see the rest
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
        {other.status === 'ready' ? <span className="count">{other.printings.length}</span> : null}
      </div>
      {other.status === 'loading' ? <p className="breathe text-[13px] text-ink-dim">Looking for other printings…</p> : null}
      {other.status === 'error' ? <p className="text-[13px] text-ink-dim">Other printings are unavailable right now.</p> : null}
      {other.status === 'ready' && other.printings.length === 0 ? (
        <p className="text-[13px] text-ink-dim">This is the only printing of this card in the catalog.</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="stagger space-y-0.5">
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
