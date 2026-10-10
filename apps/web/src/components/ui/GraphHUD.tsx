'use client'

import { useMemo } from 'react'
import { NODE_TYPES, type NodeType } from '@constellation/domain'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { nodeColor, useSceneTheme } from '@/lib/theme'
import type { ViewMode } from '@/lib/url'
import { useGraphStore } from '@/state/graph-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useTimeStore } from '@/state/time-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'

const DEPTHS: Array<{ value: number; label: string; title: string }> = [
  { value: 1, label: 'Direct', title: 'Only what is directly connected to the focus' },
  { value: 2, label: 'Extended', title: 'Also the cards reached through them: the same card, the same Pokémon, the same artist' },
]

/** What the ring colors in the sky mean, for the kinds of points on screen right now. */
function Legend() {
  const theme = useSceneTheme()
  const nodes = useGraphStore((s) => s.nodes)
  const owned = useOwnershipStore((s) => s.ownedNodeIds)
  const focusOnOwned = useOwnershipStore((s) => s.focusOnOwned)
  const toggleFocusOnOwned = useOwnershipStore((s) => s.toggleFocusOnOwned)
  const ownedHere = useMemo(() => nodes.some((n) => owned.has(n.id)), [nodes, owned])
  const entries = useMemo(() => {
    const present = new Set(nodes.map((n) => n.nodeType))
    const byColor = new Map<string, NodeType[]>()
    for (const type of NODE_TYPES) {
      if (!present.has(type) || type === 'game') continue
      const color = nodeColor(theme, type)
      byColor.set(color, [...(byColor.get(color) ?? []), type])
    }
    return [...byColor.entries()].map(([color, types]) => ({ color, label: types.map((t) => NODE_TYPE_LABELS[t]).join(' · ') }))
  }, [nodes, theme])
  if (entries.length === 0) return null
  return (
    <div className="panel pill pointer-events-auto hidden items-center gap-3 px-3 py-2 text-[12px] text-ink-dim lg:flex" aria-label="Legend">
      <span className="eyebrow">Rings</span>
      {entries.map((e) => (
        <span key={e.color} className="flex items-center gap-1.5">
          <span className="dot" style={{ color: e.color, background: theme.nodeFill }} aria-hidden />
          {e.label}
        </span>
      ))}
      {ownedHere ? (
        <button
          type="button"
          onClick={toggleFocusOnOwned}
          aria-pressed={focusOnOwned}
          className={`fade-up flex items-center gap-1.5 rounded-full px-1.5 ${focusOnOwned ? 'bg-primary/20 text-ink' : ''}`}
          title={focusOnOwned ? 'Showing only your constellation; click to show everything' : 'Cards in your constellation; click to let everything else step back'}
        >
          <span className="dot" style={{ color: theme.ownership, background: theme.nodeFill }} aria-hidden />
          {focusOnOwned ? 'only yours' : 'yours'}
        </button>
      ) : null}
    </div>
  )
}

export function GraphHUD({ view }: { view: ViewMode }) {
  const navigation = useExploreNavigation()
  const depth = useGraphStore((s) => s.depth)
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const year = useTimeStore((s) => s.year)
  const steps = useTimeStore((s) => s.steps)
  const setPlaying = useTimeStore((s) => s.setPlaying)
  const lens = navigation.current.lens
  const webgl = useUiStore((s) => s.webgl)
  const reducedMotion = useUiStore((s) => s.reducedMotion)

  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 px-4 py-3">
      <div className="flex items-end gap-2">
        {view === '3d' ? <Legend /> : null}
        <a
          href="/help#credits"
          className="panel pill pointer-events-auto hidden px-3 py-2 text-[11.5px] text-ink-dim hover:text-ink md:inline-flex"
          title="Where the data comes from and whose it is"
        >
          Data: TCGdex · © Pokémon
        </a>
      </div>

      <div className="panel pill pointer-events-auto flex items-center gap-1 p-1 text-[13px]">
        <div className="flex items-center gap-1 pl-1 pr-1" role="group" aria-label="Ways to look">
          <button
            type="button"
            aria-pressed={year !== null}
            disabled={steps.length === 0 && year === null}
            onClick={() => {
              if (year !== null) {
                setPlaying(false)
                navigation.setYear(null)
              } else if (steps[0] !== undefined) {
                navigation.setYear(steps[0])
                setPlaying(true)
              }
            }}
            className={`btn pill ${year !== null ? 'btn-on' : 'btn-quiet'}`}
            title={steps.length === 0 ? 'Nothing on screen has a date' : year !== null ? 'Back to all of time (T)' : 'The sky through the years (T)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="8.5" />
              <path d="M12 7.5V12l3 2" />
            </svg>
            <span className="hidden sm:inline">Time</span>
          </button>
          <button
            type="button"
            aria-pressed={lens === 'landmarks'}
            onClick={() => (lens === 'landmarks' ? navigation.closeLens(null) : navigation.openLandmarks())}
            className={`btn pill ${lens === 'landmarks' ? 'btn-on' : 'btn-quiet'}`}
            title={lens === 'landmarks' ? 'Back to the whole sky' : 'The points worth knowing first, and why'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />
            </svg>
            <span className="hidden sm:inline">Landmarks</span>
          </button>
        </div>
        {!isUniverse && !lens ? (
          <div className="flex items-center gap-1 border-l border-ink/10 pl-2 pr-1" role="group" aria-label="How far to explore">
            <span className="eyebrow mr-1 hidden sm:inline">Connections</span>
            {DEPTHS.map((d) => (
              <button key={d.value} type="button" aria-pressed={depth === d.value} onClick={() => navigation.setDepth(d.value)} className={`btn pill ${depth === d.value ? 'btn-on' : 'btn-quiet'}`} title={d.title}>
                {d.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-1 border-l border-ink/10 pl-2" role="group" aria-label="View mode">
          <button
            type="button"
            aria-pressed={view === '3d'}
            disabled={webgl === false}
            onClick={() => navigation.setView('3d')}
            className={`btn pill ${view === '3d' ? 'btn-on' : 'btn-quiet'}`}
            title={webgl === false ? 'WebGL is not available in this browser' : 'Constellation view (L)'}
          >
            3D
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => navigation.setView('list')} className={`btn pill ${view === 'list' ? 'btn-on' : 'btn-quiet'}`} title="List view (L)">
            List
          </button>
        </div>
        {reducedMotion ? (
          <span className="px-2 text-[12px] text-ink-dim" title="Reduced motion is on: flights and reveals are instant">
            Reduced motion
          </span>
        ) : null}
      </div>
    </footer>
  )
}
