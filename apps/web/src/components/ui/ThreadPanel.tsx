'use client'

import { useEffect, useRef } from 'react'
import { stepBrightness } from '@/lib/thread'
import { useNodeColor } from '@/lib/theme'
import { useGraphStore } from '@/state/graph-store'
import { useThreadStore } from '@/state/thread-store'
import { useExploreNavigation } from '../navigation'

/**
 * "Your thread": every point visited in this session, in order, as in the sky. A step takes the
 * focus back there (and becomes a new step: the thread only grows). Lives in this tab only.
 */
export function ThreadPanel() {
  const navigation = useExploreNavigation()
  const colorOf = useNodeColor()
  const steps = useThreadStore((s) => s.steps)
  const open = useThreadStore((s) => s.open)
  const toggle = useThreadStore((s) => s.toggle)
  const clear = useThreadStore((s) => s.clear)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const listRef = useRef<HTMLOListElement>(null)

  // The latest step is the one in view.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [open, steps.length])

  if (steps.length === 0) return null

  return (
    <div className="pointer-events-none absolute bottom-16 left-4 z-30 flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2">
      {open ? (
        <section id="thread-panel" aria-label="Your thread" className="panel scroll-thin fade-up pointer-events-auto flex max-h-[45vh] w-[18rem] flex-col">
          <div className="flex items-center justify-between px-4 pb-1 pt-3">
            <h2 className="serif text-[16px]">Your thread</h2>
            <button type="button" onClick={clear} className="btn btn-quiet text-[12px]" title="Start the thread again from the next point">
              Clear
            </button>
          </div>
          <p className="px-4 pb-2 text-[12px] text-ink-dim">Where you have been in this session. Pick a step to go back there.</p>
          <ol ref={listRef} className="scroll-thin overflow-y-auto px-2 pb-3">
            {steps.map((step, i) => {
              const here = step.id === focusNodeId && i === steps.length - 1
              return (
                <li key={`${step.id}-${i}`} style={{ opacity: Math.max(0.45, stepBrightness(i, steps.length)) }}>
                  <button
                    type="button"
                    onClick={() => navigation.goTo(step.id, { follow: true })}
                    aria-current={here ? 'step' : undefined}
                    className={`row-link ${here ? 'bg-primary/15' : ''}`}
                    title={`Back to ${step.label}`}
                    data-node-id={step.id}
                  >
                    <span className="count w-5 flex-none text-right">{i + 1}</span>
                    <span className="dot" style={{ color: colorOf(step.nodeType) }} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{step.label}</span>
                    {step.subtitle ? <span className="max-w-[40%] truncate text-[12px] text-ink-dim">{step.subtitle}</span> : null}
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="thread-panel"
        className={`panel pill pointer-events-auto flex items-center gap-2 px-3 py-2 text-[12.5px] ${open ? 'text-ink' : 'text-ink-dim hover:text-ink'}`}
        title={open ? 'Hide your thread' : 'Where you have been in this session'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="5" cy="18" r="2" />
          <circle cx="12" cy="9" r="2" />
          <circle cx="19" cy="15" r="2" />
          <path d="M6.5 16.5 10.6 10.5M13.6 10.2l3.9 3.6" strokeDasharray="2 2.5" />
        </svg>
        Your thread · {steps.length}
      </button>
    </div>
  )
}
