'use client'

import { NODE_TYPE_LABELS } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'
import { buildExploreUrl } from '@/lib/url'
import { useGraphStore } from '@/state/graph-store'
import { useExploreNavigation } from '../navigation'
import { useRelationshipGroups } from '../useRelationshipGroups'

/**
 * Semantic 2D view: the same focus + relationships as the 3D scene, as plain navigable lists.
 * Used when WebGL is unavailable, for reduced motion, or whenever the user prefers it.
 */
export function RelationshipList() {
  const navigation = useExploreNavigation()
  const { focus, groups } = useRelationshipGroups()
  const nodes = useGraphStore((s) => s.nodes)
  const distances = useGraphStore((s) => s.distances)
  const isUniverse = useGraphStore((s) => s.isUniverse)
  const colorOf = useNodeColor()

  const current = navigation.current
  const hrefFor = (nodeId: string) => buildExploreUrl({ ...current, node: nodeId, depth: 1 })

  if (!focus) return null

  const universeSeries = isUniverse ? nodes.filter((n) => n.nodeType === 'series') : []
  const universeSets = isUniverse ? nodes.filter((n) => n.nodeType === 'set') : []
  const farther = Object.entries(distances)
    .filter(([, d]) => d >= 2)
    .map(([id]) => nodes.find((n) => n.id === id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))

  const link = (nodeId: string, follow: boolean, className: string, children: React.ReactNode, title?: string) => (
    <a
      href={hrefFor(nodeId)}
      onClick={(e) => {
        e.preventDefault()
        navigation.goTo(nodeId, { follow })
      }}
      className={className}
      title={title}
    >
      {children}
    </a>
  )

  return (
    <main
      id="relationship-list"
      aria-label="Semantic relationship view"
      className="scroll-thin absolute inset-x-0 bottom-16 top-16 z-10 mx-auto w-full max-w-3xl overflow-y-auto px-4 sm:pr-[22rem]"
    >
      <div className="glass fade-up rounded-xl p-5">
        <p className="hud-label mb-1">{NODE_TYPE_LABELS[focus.nodeType]}</p>
        <h1 className="title-shimmer text-2xl font-semibold tracking-wide">{focus.label}</h1>
        {focus.subtitle ? <p className="text-sm text-ink-dim">{focus.subtitle}</p> : null}

        {isUniverse ? (
          <div className="mt-6 space-y-6">
            <section aria-label="Series">
              <h2 className="hud-label mb-2">Series</h2>
              <ul className="grid grid-cols-2 gap-1 md:grid-cols-3">
                {universeSeries.map((series, i) => (
                  <li key={series.id} className="pop-in" style={{ '--i': i } as React.CSSProperties}>
                    {link(
                      series.id,
                      false,
                      'lift focus-ring block truncate rounded-md px-2 py-1 text-sm hover:bg-primary/15',
                      <>
                        {series.label}
                        <span className="ml-2 text-[10px] text-ink-dim">{series.subtitle}</span>
                      </>,
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <section aria-label="Sets">
              <h2 className="hud-label mb-2">Sets</h2>
              <ul className="grid grid-cols-2 gap-1 md:grid-cols-3">
                {universeSets.map((set, i) => (
                  <li key={set.id} className="pop-in" style={{ '--i': Math.min(i, 30) } as React.CSSProperties}>
                    {link(
                      set.id,
                      false,
                      'lift focus-ring block truncate rounded-md px-2 py-1 text-sm hover:bg-primary/15',
                      <>
                        {set.label}
                        <span className="ml-2 text-[10px] text-ink-dim">{set.subtitle}</span>
                      </>,
                      String(set.metadata.releaseDate ?? ''),
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {groups.map((group, gi) => (
              <section key={group.key} aria-label={group.label} className="pop-in" style={{ '--i': gi } as React.CSSProperties}>
                <h2 className="hud-label mb-2 flex items-center justify-between">
                  <span>{group.label}</span>
                  <span className="font-mono">{group.total}</span>
                </h2>
                <ul className="grid grid-cols-1 gap-1 md:grid-cols-2">
                  {group.items.map(({ node, metadata }) => (
                    <li key={node.id}>
                      {link(
                        node.id,
                        true,
                        'lift focus-ring flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-primary/15',
                        <>
                          <span
                            className="h-1.5 w-1.5 flex-none rounded-full"
                            style={{ background: colorOf(node.nodeType), boxShadow: '0 0 0 1px var(--c-outline)' }}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1 truncate">{node.label}</span>
                          <span className="truncate text-[10px] text-ink-dim">
                            {typeof metadata.value === 'string' ? metadata.value : node.subtitle}
                          </span>
                        </>,
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {farther.length > 0 ? (
              <section aria-label="Further connections">
                <h2 className="hud-label mb-2">Further connections</h2>
                <ul className="flex flex-wrap gap-1">
                  {farther.slice(0, 120).map((node) => (
                    <li key={node.id}>
                      {link(
                        node.id,
                        false,
                        'chip focus-ring block rounded-full border border-ink-dim/20 px-2 py-0.5 text-xs text-ink-dim hover:text-ink',
                        node.label,
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  )
}
