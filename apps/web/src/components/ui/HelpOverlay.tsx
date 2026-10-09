'use client'

import Link from 'next/link'
import { isMac } from '@/lib/env'
import { HOW_IT_WORKS, SHORTCUTS } from '@/lib/help-content'
import { useUiStore } from '@/state/ui-store'

export function HelpOverlay() {
  const open = useUiStore((s) => s.helpOpen)
  const setOpen = useUiStore((s) => s.setHelpOpen)
  if (!open) return null
  const mod = isMac() ? '⌘' : 'Ctrl'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/60 p-4 backdrop-blur-sm" onMouseDown={() => setOpen(false)} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Help" className="panel panel-strong fade-up w-full max-w-lg p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="serif text-[24px] leading-tight">Explore by following connections</h2>
          <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet" aria-label="Close help">
            ×
          </button>
        </div>
        <ol className="space-y-2 text-[14px] text-ink/90">
          {HOW_IT_WORKS.map((step) => (
            <li key={step.title}>
              <strong className="font-semibold">{step.title}</strong> {step.text}
            </li>
          ))}
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
        <p className="mt-5 text-[13px] text-ink-dim">
          More in the{' '}
          <Link href="/help" className="text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
            help page
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
