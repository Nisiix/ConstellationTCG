'use client'

import { useEffect, useRef, useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { ApiError, fetchConnections, type ConnectionsPage } from '@/lib/api'
import { relationshipLabel } from '@/lib/colors'
import { connectionNodeTypes } from '@/lib/connections'
import { formatDate } from '@/lib/dates'
import { isLogoType } from '@/lib/images'
import { filtersKey, type ExplorePanel } from '@/lib/url'
import { useGraphStore } from '@/state/graph-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'
import { NodeImage } from './NodeImage'

const PAGE = 60

type ListPanel = Extract<ExplorePanel, { kind: 'list' }>
type Item = ConnectionsPage['items'][number]

/** What a row says under the name: a card's set and number, an expansion's date, else the subtitle. */
function rowSubtitle(node: GraphNode): string | null {
  if (node.nodeType === 'set' || node.nodeType === 'series') {
    const date = formatDate(typeof node.metadata.releaseDate === 'string' ? node.metadata.releaseDate : null)
    return [node.nodeType === 'set' ? node.subtitle : null, date].filter(Boolean).join(' · ') || null
  }
  return node.subtitle
}

/**
 * Every connection of one kind, on a page of its own: opened from "Show all" instead of growing the
 * panel, with Back to where it was opened. Pages load as the list scrolls.
 */
export function ConnectionList({ panel, variant }: { panel: ListPanel; variant: 'panel' | 'page' }) {
  const navigation = useExploreNavigation()
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const setHighlight = useUiStore((s) => s.setHighlight)
  const owned = useOwnershipStore((s) => s.ownedNodeIds)
  const ofId = panel.of ?? navigation.current.node ?? focusNodeId
  const filters = navigation.current.filters
  const key = `${ofId}|${panel.relationshipType}|${panel.direction}|${filtersKey(filters)}`

  const [state, setState] = useState<{
    key: string
    owner: GraphNode | null
    items: Item[]
    total: number | null
    status: 'loading' | 'ready' | 'error'
    error: string | null
  }>({ key, owner: null, items: [], total: null, status: 'loading', error: null })
  const sentinel = useRef<HTMLLIElement>(null)
  const inFlight = useRef(false)

  const load = (offset: number, signal?: AbortSignal) => {
    if (!ofId) return
    inFlight.current = true
    fetchConnections(
      ofId,
      { relationshipType: panel.relationshipType, direction: panel.direction, offset, limit: PAGE, nodeTypes: connectionNodeTypes(filters), filters },
      signal,
    )
      .then((page) =>
        setState((prev) => ({
          key,
          owner: page.node,
          items: offset === 0 || prev.key !== key ? page.items : [...prev.items, ...page.items],
          total: page.total,
          status: 'ready',
          error: null,
        })),
      )
      .catch((error: unknown) => {
        if ((error as Error).name === 'AbortError') return
        setState((prev) => ({ ...prev, status: 'error', error: error instanceof ApiError ? error.message : 'Could not load the list.' }))
      })
      .finally(() => {
        inFlight.current = false
      })
  }

  // First page whenever the list changes.
  useEffect(() => {
    const controller = new AbortController()
    setState({ key, owner: null, items: [], total: null, status: 'loading', error: null })
    load(0, controller.signal)
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // The next page when the end of the list comes into view.
  const more = state.total !== null && state.items.length < state.total
  useEffect(() => {
    const target = sentinel.current
    if (!target || !more) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !inFlight.current) load(state.items.length)
    })
    observer.observe(target)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [more, state.items.length, key])

  const title = relationshipLabel(panel.relationshipType, panel.direction)
  const wide = variant === 'page'

  return (
    <section aria-label={`${title}${state.owner ? ` · ${state.owner.label}` : ''}`} className={wide ? 'panel fade-up p-5' : 'fade-up'}>
      <div className={wide ? 'mb-4' : 'p-5 pb-3'}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" onClick={navigation.closePanel} className="btn btn-quiet text-[12.5px]" title="Back to where this list was opened">
            ← Back
          </button>
          {state.total !== null ? <span className="count">{state.total}</span> : null}
        </div>
        <p className="eyebrow">{title}</p>
        <h1 className="title-reveal text-[22px] leading-tight text-ink">{state.owner?.label ?? '…'}</h1>
      </div>

      {state.status === 'error' ? <p className={`text-[13px] text-ink-dim ${wide ? '' : 'px-5 pb-5'}`}>{state.error}</p> : null}
      {state.status === 'ready' && state.items.length === 0 ? (
        <p className={`text-[13px] text-ink-dim ${wide ? '' : 'px-5 pb-5'}`}>Nothing to list here with the current filters.</p>
      ) : null}

      <ul className={wide ? 'grid gap-1 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-0.5 border-t border-ink/10 px-3 py-3'}>
        {state.items.map(({ node, metadata }) => (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => navigation.goTo(node.id, { follow: true })}
              onMouseEnter={() => setHighlight([node.id])}
              onMouseLeave={() => setHighlight(null)}
              className="row-link"
              title={`Fly to ${node.label}`}
              data-node-id={node.id}
            >
              <NodeImage
                node={node}
                small
                alt=""
                loading="lazy"
                className={isLogoType(node.nodeType) ? 'h-6 w-9 flex-none rounded-sm bg-node object-contain' : 'img-frame h-10 w-7 flex-none rounded object-cover'}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px]">
                  {node.label}
                  {owned.has(node.id) ? <span className="owned-mark ml-1.5">yours</span> : null}
                </span>
                <span className="block truncate text-[12px] text-ink-dim">
                  {typeof metadata.value === 'string' ? metadata.value : rowSubtitle(node)}
                </span>
              </span>
            </button>
          </li>
        ))}
        {more ? (
          <li ref={sentinel} className="breathe px-2 py-2 text-[12.5px] text-ink-dim" aria-live="polite">
            Loading more…
          </li>
        ) : null}
        {state.status === 'loading' ? <li className="breathe px-2 py-2 text-[12.5px] text-ink-dim">Loading…</li> : null}
      </ul>
    </section>
  )
}
