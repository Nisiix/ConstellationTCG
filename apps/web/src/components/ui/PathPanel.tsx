'use client'

import { useState } from 'react'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { neighbours, stepPhrase } from '@/lib/path-steps'
import { PATH_DEPTH_LIMIT } from '@/lib/url'
import { useNodeColor } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { usePathStore } from '@/state/path-store'
import { useExploreNavigation } from '../navigation'

/**
 * The path between two points: the whole chain at once, a compact line per connection, and the
 * step in hand. ← and → (or a click on a step, here or in the sky) walk it; the steps walked join
 * the thread. In the sky it is the right-hand panel; in the list view it is the page.
 */
export function PathPanel({ variant }: { variant: 'panel' | 'page' }) {
  const navigation = useExploreNavigation()
  const colorOf = useNodeColor()
  const status = usePathStore((s) => s.status)
  const data = usePathStore((s) => s.data)
  const error = usePathStore((s) => s.error)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const [copied, setCopied] = useState(false)
  const ends = navigation.current.path

  if (!ends) return null
  const cursor = focusNodeId ?? ends[0]
  const found = data?.found ? data : null
  const { previous, next, index } = found ? neighbours(found, cursor) : { previous: null, next: null, index: -1 }
  const walk = (id: string) => navigation.goTo(id, { follow: true, keepPath: true, replace: true })

  const share = async () => {
    try {
      await navigator.clipboard.writeText(navigation.shareUrl())
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  const shell =
    variant === 'panel'
      ? 'panel scroll-thin fade-up absolute right-4 top-16 z-30 flex max-h-[calc(100vh-9rem)] w-[21rem] max-w-[calc(100vw-2rem)] flex-col overflow-y-auto'
      : 'panel fade-up mx-auto w-full max-w-2xl'

  const body = (
    <section className={shell} aria-label="Path" id="path-panel">
      <div className="p-5 pb-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="eyebrow">Path</span>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={share} className="btn btn-quiet text-[12.5px]" title="Copy a link to this path">
              {copied ? 'Link copied' : 'Share'}
            </button>
            <button type="button" onClick={() => navigation.leavePath(cursor)} className="btn btn-quiet text-[12.5px]" title="Leave the path and explore from the step in hand">
              Explore from here
            </button>
          </div>
        </div>
        <h1 className="text-[20px] leading-tight text-ink">
          {data ? (
            <>
              {data.from.label} <span className="text-ink-dim">→</span> {data.to.label}
            </>
          ) : (
            'Finding the path…'
          )}
        </h1>
        {found ? (
          <p className="mt-1 text-[13px] text-ink-dim">
            {found.edges.length === 1 ? '1 step' : `${found.edges.length} steps`}
            {index >= 0 ? ` · on step ${index + 1} of ${found.nodes.length}` : ''}
          </p>
        ) : null}
      </div>

      {status === 'loading' && !data ? <p className="breathe px-5 pb-5 text-[13px] text-ink-dim">Looking for the shortest chain of connections…</p> : null}
      {status === 'error' ? <p className="px-5 pb-5 text-[13px] text-ink-dim">{error ?? 'The path is unavailable right now.'}</p> : null}

      {data && !data.found ? (
        <div className="border-t border-ink/10 px-5 py-4 text-[13.5px]" role="status">
          {data.reason === 'different-games' ? (
            <p>These two points belong to different games: no connection joins them.</p>
          ) : (
            <>
              <p>
                No path within {data.maxDepth === 1 ? "1 step" : `${data.maxDepth} steps`}.
                {data.maxDepth >= PATH_DEPTH_LIMIT ? ' These two points are too far apart to show as a path.' : ''}
              </p>
              {data.maxDepth < PATH_DEPTH_LIMIT ? (
                <button type="button" onClick={navigation.searchFurther} className="btn btn-ghost pill mt-3 text-[12.5px]">
                  Search further ({PATH_DEPTH_LIMIT} steps)
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {found ? (
        <>
          <ol className="border-t border-ink/10 px-3 py-3" aria-label="Steps of the path">
            {found.nodes.map((node, i) => {
              const edge = found.edges[i]
              const nextNode = found.nodes[i + 1]
              const here = node.id === cursor
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    onClick={() => walk(node.id)}
                    aria-current={here ? 'step' : undefined}
                    className={`row-link ${here ? 'bg-primary/15' : ''}`}
                    title={`Go to ${node.label}`}
                    data-node-id={node.id}
                  >
                    <span className="count w-5 flex-none text-right">{i + 1}</span>
                    <span className="dot" style={{ color: colorOf(node.nodeType) }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{node.label}</span>
                    <span className="max-w-[40%] truncate text-[12px] text-ink-dim">{node.subtitle ?? NODE_TYPE_LABELS[node.nodeType]}</span>
                  </button>
                  {edge && nextNode ? (
                    <p className="py-0.5 pl-12 text-[12px] text-ink-dim" data-testid="path-step-label">
                      {node.label} — {stepPhrase(edge, node.id)} → {nextNode.label}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ol>
          <div className="flex items-center justify-between gap-2 border-t border-ink/10 px-5 py-3">
            <button type="button" disabled={!previous} onClick={() => previous && walk(previous)} className="btn btn-quiet whitespace-nowrap text-[12.5px]" title="Previous step (←)">
              ← Previous
            </button>
            {variant === 'page' ? (
              <span className="hidden text-[11.5px] text-ink-dim sm:inline">
                <kbd>←</kbd> <kbd>→</kbd> to walk
              </span>
            ) : null}
            <button type="button" disabled={!next} onClick={() => next && walk(next)} className="btn btn-quiet whitespace-nowrap text-[12.5px]" title="Next step (→)">
              Next →
            </button>
          </div>
        </>
      ) : null}
    </section>
  )

  if (variant === 'panel') return body
  return (
    <main id="relationship-list" aria-label="List view" className="scroll-thin absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto px-4 pb-24 pt-3">
      {body}
    </main>
  )
}
