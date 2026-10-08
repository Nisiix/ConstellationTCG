'use client'

import { isMac } from '@/lib/env'
import { useUiStore } from '@/state/ui-store'

const SHORTCUTS: Array<[string, string]> = [
  ['/', 'Search'],
  ['⌘K', 'Commands'],
  ['E', 'Show more connections'],
  ['C', 'Direct connections only'],
  ['F', 'Filters'],
  ['L', 'Switch 3D / list'],
  ['U', 'Back to the universe'],
  ['⌫', 'Go back'],
  ['Esc', 'Close panels'],
  ['?', 'This help'],
]

export function HelpOverlay() {
  const open = useUiStore((s) => s.helpOpen)
  const setOpen = useUiStore((s) => s.setHelpOpen)
  if (!open) return null
  const mod = isMac() ? '⌘' : 'Ctrl'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/60 p-4 backdrop-blur-sm" onMouseDown={() => setOpen(false)} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Help" className="panel panel-strong fade-up w-full max-w-lg p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">How it works</p>
            <h2 className="serif text-[24px] leading-tight">Explore by following connections</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet" aria-label="Close help">
            ×
          </button>
        </div>
        <ol className="space-y-2 text-[14px] text-ink/90">
          <li>
            <strong className="font-semibold">Search</strong> a card, a set, a Pokémon or an artist. The camera flies there.
          </li>
          <li>
            <strong className="font-semibold">Look around.</strong> The points around the focus are its connections: drag to orbit, scroll to zoom, hover for names.
          </li>
          <li>
            <strong className="font-semibold">Follow</strong> any connection by clicking it, in the scene or in the panel on the right.
          </li>
          <li>
            <strong className="font-semibold">Go wider</strong> with “Show more” (extended and deep connections) or narrow down with filters.
          </li>
          <li>
            <strong className="font-semibold">Share</strong> any view: the link holds the focus, the depth and the filters.
          </li>
        </ol>
        <h3 className="eyebrow mb-2 mt-5">Keyboard</h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <dt className="text-ink-dim">{label}</dt>
              <dd>
                <kbd>{key.replace('⌘', mod)}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
