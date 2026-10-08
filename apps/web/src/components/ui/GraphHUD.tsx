'use client'

import type { ViewMode } from '@/lib/url'
import { useCameraStore } from '@/state/camera-store'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'

const DEPTHS: Array<{ value: number; label: string; title: string }> = [
  { value: 1, label: 'Direct', title: 'Only what is directly connected to the focus' },
  { value: 2, label: 'Extended', title: 'Also what those connections are connected to' },
  { value: 3, label: 'Deep', title: 'Three hops away from the focus' },
]

export function GraphHUD({ view }: { view: ViewMode }) {
  const navigation = useExploreNavigation()
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const nodes = useGraphStore((s) => s.nodes)
  const edges = useGraphStore((s) => s.edges)
  const depth = useGraphStore((s) => s.depth)
  const summary = useGraphStore((s) => s.summary)
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const transition = useCameraStore((s) => s.transition)
  const webgl = useUiStore((s) => s.webgl)
  const reducedMotion = useUiStore((s) => s.reducedMotion)
  const focus = nodes.find((n) => n.id === focusNodeId)
  const relationships = summary.reduce((sum, s) => sum + s.count, 0)

  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between gap-4 px-4 py-3">
      <div className="panel pill pointer-events-auto flex items-center gap-3 px-4 py-2 text-[13px]">
        <span
          className={`dot ${transition === 'moving' ? 'dot-ping' : ''}`}
          style={{ color: transition === 'moving' ? 'var(--c-primary)' : 'var(--c-text-dim)' }}
          aria-hidden
          title={transition === 'moving' ? 'Camera is flying' : 'Camera is idle'}
        />
        <span className="max-w-[18rem] truncate text-ink" key={focus?.id}>
          {focus?.label ?? '—'}
        </span>
        <span className="text-ink-dim">
          {isUniverse
            ? `${nodes.length} points`
            : `${relationships} connection${relationships === 1 ? '' : 's'} · ${nodes.length} point${nodes.length === 1 ? '' : 's'} shown`}
        </span>
        <span className="hidden text-ink-dim/70 lg:inline">· {edges.length} links</span>
      </div>

      <div className="panel pill pointer-events-auto flex items-center gap-1 p-1 text-[13px]">
        {!isUniverse ? (
          <div className="flex items-center gap-1 pl-2 pr-1" role="group" aria-label="How far to explore">
            <span className="eyebrow mr-1">Connections</span>
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
