'use client'

import type { ViewMode } from '@/lib/url'
import { useCameraStore } from '@/state/camera-store'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'

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
      <div className="glass pointer-events-auto flex items-center gap-4 rounded-full px-4 py-2 text-xs">
        <span className="hud-label">Focus</span>
        <span className="max-w-[16rem] truncate text-ink" key={focus?.id}>
          {focus?.label ?? '—'}
        </span>
        {!isUniverse ? (
          <span className="text-ink-dim">
            {relationships} relationship{relationships === 1 ? '' : 's'}
          </span>
        ) : (
          <span className="text-ink-dim">universe</span>
        )}
        <span className="font-mono text-[10px] text-ink-dim">
          {nodes.length}n · {edges.length}e
        </span>
        <span
          className={`h-1.5 w-1.5 rounded-full ${transition === 'moving' ? 'dot-ping bg-primary' : 'bg-ink-dim/40'}`}
          aria-hidden
          title="camera"
        />
      </div>

      <div className="glass pointer-events-auto flex items-center gap-1 rounded-full p-1 text-xs">
        {!isUniverse ? (
          <div className="flex items-center gap-1 px-2" role="group" aria-label="Graph depth">
            <span className="hud-label">Depth</span>
            {[1, 2, 3].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={depth === d}
                onClick={() => navigation.setDepth(d)}
                className={`chip focus-ring h-6 w-6 rounded-full font-mono text-[11px] ${
                  depth === d ? 'bg-primary/25 text-primary shadow-[0_0_0_1px_var(--c-outline)]' : 'text-ink-dim hover:text-ink'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-1 border-l border-ink-dim/20 pl-2" role="group" aria-label="View mode">
          <button
            type="button"
            aria-pressed={view === '3d'}
            disabled={webgl === false}
            onClick={() => navigation.setView('3d')}
            className={`chip focus-ring rounded-full px-2.5 py-1 disabled:opacity-40 ${view === '3d' ? 'bg-primary/25 text-primary' : 'text-ink-dim hover:text-ink'}`}
            title={webgl === false ? 'WebGL is not available in this browser' : '3D constellation (L)'}
          >
            3D
          </button>
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => navigation.setView('list')}
            className={`chip focus-ring rounded-full px-2.5 py-1 ${view === 'list' ? 'bg-primary/25 text-primary' : 'text-ink-dim hover:text-ink'}`}
            title="Semantic list view (L)"
          >
            List
          </button>
        </div>
        {reducedMotion ? (
          <span className="px-2 text-[10px] text-ink-dim" title="Reduced motion is on">
            RM
          </span>
        ) : null}
      </div>
    </footer>
  )
}
